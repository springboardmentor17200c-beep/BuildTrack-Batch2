import csv
import io
from datetime import datetime
from pathlib import Path

from bson import ObjectId
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

from app.core.config import BASE_DIR
from app.core.security import get_current_user
from app.db.mongodb import get_database
from app.modules.auth.db import create_user as create_auth_user, get_user_by_email
from app.modules.auth.models import UserCreate
from app.modules.notifications.db import create_notification
from app.modules.procurement.db import (
    assign_vendor_to_material_request,
    approve_material_request,
    create_delivery_and_inventory,
    create_doc,
    create_material_request,
    create_payment_for_invoice,
    create_purchase_order_from_request,
    dashboard_stats,
    delete_doc,
    get_doc,
    get_inventory_history,
    list_docs,
    list_materials_from_inventory,
    update_doc,
    update_invoice_status,
    update_purchase_order,
    vendor_dashboard_stats,
    vendor_respond_to_request,
)
from app.modules.procurement.models import (
    ApprovalAction,
    DashboardStats,
    Delivery,
    DeliveryCreate,
    DeliveryUpdate,
    InventoryItem,
    Invoice,
    InvoiceAction,
    InvoiceCreate,
    InvoiceUpdate,
    MaterialItem,
    MaterialRequest,
    MaterialRequestCreate,
    MaterialRequestUpdate,
    Payment,
    PaymentCreate,
    PaymentUpdate,
    PurchaseOrder,
    PurchaseOrderCreate,
    PurchaseOrderUpdate,
    Vendor,
    VendorAssignment,
    VendorCreate,
    VendorCreateWithAccount,
    VendorDashboardStats,
    VendorResponseAction,
    VendorUpdate,
)

router = APIRouter()
UPLOAD_DIR = BASE_DIR / "uploads" / "invoices"


ROLE_GROUPS = {
    "admin": {"admin"},
    "project_manager": {"admin", "manager"},
    "site_engineer": {"admin", "manager", "engineer"},
    "store_manager": {"admin", "store_manager", "store manager"},
    "finance": {"admin", "finance"},
    "vendor": {"vendor"},
}


def require_vendor(user: dict) -> str:
    """Ensure the logged-in user is a vendor linked to a vendor record and return vendor_id."""
    if user.get("role") != "vendor":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Vendor access required")
    vendor_id = user.get("vendor_id")
    if not vendor_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is not linked to a vendor record")
    return str(vendor_id)


async def notify_vendor_user(db, vendor_id: str, notification_data: dict):
    """Notify all user accounts linked to the given vendor record."""
    users = await db.users.find({"role": "vendor", "vendor_id": vendor_id}).to_list(50)
    for vendor_user in users:
        data = dict(notification_data)
        data["user_id"] = str(vendor_user["_id"])
        await create_notification(db, data)


def serialize(value):
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, datetime):
        return value
    if isinstance(value, list):
        return [serialize(item) for item in value]
    if isinstance(value, dict):
        return {key: serialize(item) for key, item in value.items()}
    return value


def serialize_doc(doc: dict) -> dict:
    return serialize(dict(doc))


def page(items: dict) -> dict:
    return {"items": [serialize_doc(item) for item in items["items"]], "total": items["total"]}


def normalize_inventory(doc: dict) -> dict:
    """Bring any `inventory` document (regardless of which schema created it) into
    the unified shape the procurement UI expects: material + stock_quantity."""
    d = dict(doc)
    if "_id" in d:
        d["_id"] = str(d["_id"])
    d["material"] = d.get("material") or d.get("material_name") or "Unnamed Item"
    try:
        d["stock_quantity"] = float(d.get("stock_quantity") or d.get("quantity") or 0)
    except (TypeError, ValueError):
        d["stock_quantity"] = 0
    d["transactions"] = d.get("transactions") or []
    return d


def require_role(user: dict, group: str):
    if user.get("role") not in ROLE_GROUPS[group]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient procurement permissions")


def list_params(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: str | None = None,
    sort_by: str = "created_at",
    sort_dir: str = Query("desc", pattern="^(asc|desc)$"),
):
    return skip, limit, search, sort_by, -1 if sort_dir == "desc" else 1


def money(value) -> str:
    try:
        return f"Rs {float(value):,.2f}"
    except (TypeError, ValueError):
        return "Rs 0.00"


def short_date(value) -> str:
    if isinstance(value, datetime):
        return value.strftime("%d %b, %Y")
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).strftime("%d %b, %Y")
        except ValueError:
            return value
    return "-"


def draw_document_template(pdf: canvas.Canvas, *, title: str, number: str, accent: colors.Color):
    width, height = letter
    dark = colors.HexColor("#1f2933")
    light = colors.HexColor("#eef2f7")

    pdf.setFillColor(dark)
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(56, height - 66, "BUILD")
    pdf.setFillColor(accent)
    pdf.drawString(56, height - 79, "TRACK")

    pdf.setFillColor(dark)
    pdf.setFont("Helvetica", 10)
    pdf.drawRightString(width - 56, height - 66, f"NO. {number}")

    pdf.setFont("Helvetica-Bold", 48)
    pdf.drawString(56, height - 140, title)

    pdf.setFillColor(light)
    pdf.rect(56, 390, width - 112, 26, fill=1, stroke=0)
    pdf.setFillColor(dark)

    pdf.setFillColor(colors.HexColor("#d7dde5"))
    pdf.roundRect(-30, -90, 360, 150, 28, fill=1, stroke=0)
    pdf.setFillColor(accent)
    pdf.roundRect(185, -100, 520, 170, 36, fill=1, stroke=0)
    pdf.setFillColor(dark)


def draw_table_header(pdf: canvas.Canvas, y: int, columns: list[tuple[str, int]]):
    pdf.setFont("Helvetica-Bold", 10)
    for label, x in columns:
        pdf.drawString(x, y, label)


def draw_total_row(pdf: canvas.Canvas, y: int, label: str, amount: str):
    pdf.setStrokeColor(colors.HexColor("#e5e7eb"))
    pdf.line(60, y + 18, 552, y + 18)
    pdf.setFillColor(colors.HexColor("#111827"))
    pdf.setFont("Helvetica-Bold", 11)
    pdf.drawString(390, y, label)
    pdf.drawRightString(552, y, amount)


@router.get("/dashboard", response_model=DashboardStats)
async def dashboard(current_user=Depends(get_current_user), db=Depends(get_database)):
    return serialize_doc(await dashboard_stats(db))


@router.post("/vendors", response_model=Vendor)
async def create_vendor(vendor: VendorCreate, current_user=Depends(get_current_user), db=Depends(get_database)):
    require_role(current_user, "project_manager")
    return Vendor(**serialize_doc(await create_doc(db, "vendors", vendor.model_dump(), current_user)))


@router.post("/vendors/create-account")
async def create_vendor_with_account(
    payload: VendorCreateWithAccount,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """
    Administrator-only endpoint.

    Atomically creates:
      1. A Vendor document (company record).
      2. A User document with role='vendor' linked via vendor_id.

    If ``create_login_account`` is False only the vendor record is created
    (identical to POST /vendors).
    """

    require_role(current_user, "admin")

    # -- Validate login-account fields when requested --
    if payload.create_login_account:
        if not payload.password or len(payload.password.strip()) < 6:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password is required (min 6 characters) when creating a login account",
            )

        # Check email uniqueness in users collection
        existing_user = await get_user_by_email(db, payload.email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This email is already registered as a user account",
            )

    # -- Step 1: Create Vendor record --
    vendor_data = payload.model_dump(
        exclude={"create_login_account", "password"},
    )
    vendor_doc = await create_doc(db, "vendors", vendor_data, current_user)
    vendor_id = str(vendor_doc["_id"])

    result = {
        "vendor": serialize_doc(vendor_doc),
        "message": "Vendor created successfully",
        "user_created": False,
    }

    # -- Step 2 (optional): Create User login account --
    if payload.create_login_account:
        try:
            user_create = UserCreate(
                email=payload.email,
                full_name=payload.contact_person or payload.vendor_name,
                role="vendor",
                status="active",
                vendor_id=vendor_id,
                password=payload.password,
            )
            user_doc = await create_auth_user(db, user_create)

            # Return safe user info — NEVER the password_hash
            safe_user = {
                "_id": str(user_doc["_id"]),
                "email": user_doc["email"],
                "full_name": user_doc["full_name"],
                "role": user_doc["role"],
                "status": user_doc.get("status", "active"),
                "vendor_id": user_doc.get("vendor_id"),
            }

            result["user"] = safe_user
            result["user_created"] = True
            result["message"] = (
                f"Vendor and login account created successfully. "
                f"Login email: {payload.email}"
            )
        except Exception as exc:
            # Rollback: remove the just-created vendor if user creation fails
            await db.vendors.delete_one({"_id": vendor_doc["_id"]})
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Vendor was rolled back — user account creation failed: {exc}",
            )

    return result


@router.get("/vendors")
async def vendors(params=Depends(list_params), status_filter: str | None = None, current_user=Depends(get_current_user), db=Depends(get_database)):
    skip, limit, search, sort_by, sort_dir = params
    filters = {"status": status_filter} if status_filter else None
    return page(await list_docs(db, "vendors", skip, limit, search, ["vendor_name", "contact_person", "email", "phone"], filters, sort_by, sort_dir))


@router.get("/vendors/active")
async def active_vendors(params=Depends(list_params), current_user=Depends(get_current_user), db=Depends(get_database)):
    skip, limit, search, sort_by, sort_dir = params
    return page(await list_docs(db, "vendors", skip, limit, search, ["vendor_name", "contact_person", "email", "phone"], {"status": "active"}, sort_by, sort_dir))


@router.get("/vendors/{vendor_id}", response_model=Vendor)
async def get_vendor(vendor_id: str, current_user=Depends(get_current_user), db=Depends(get_database)):
    doc = await get_doc(db, "vendors", vendor_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return Vendor(**serialize_doc(doc))


@router.put("/vendors/{vendor_id}", response_model=Vendor)
async def edit_vendor(vendor_id: str, vendor: VendorUpdate, current_user=Depends(get_current_user), db=Depends(get_database)):
    require_role(current_user, "project_manager")
    doc = await update_doc(db, "vendors", vendor_id, vendor.model_dump(exclude_unset=True), current_user)
    if not doc:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return Vendor(**serialize_doc(doc))


@router.delete("/vendors/{vendor_id}")
async def remove_vendor(vendor_id: str, current_user=Depends(get_current_user), db=Depends(get_database)):
    require_role(current_user, "admin")
    if not await delete_doc(db, "vendors", vendor_id, current_user):
        raise HTTPException(status_code=404, detail="Vendor not found")
    return {"message": "Vendor deleted successfully"}


@router.post("/material-requests", response_model=MaterialRequest)
async def create_request(request: MaterialRequestCreate, current_user=Depends(get_current_user), db=Depends(get_database)):
    require_role(current_user, "site_engineer")
    created, error = await create_material_request(db, request.model_dump(), current_user)
    if error:
        raise HTTPException(status_code=400, detail=error)
    mr_id = str(created["_id"])
    req_no = created.get("request_id", mr_id)

    await create_notification(db, {
        "user_id": str(current_user["_id"]),
        "title": "Material Request Created",
        "message": f"Material request '{req_no}' for '{created.get('material_name', 'Material')}' created.",
        "type": "info",
        "category": "procurement_alert",
        "entity_type": "procurement",
        "entity_id": mr_id,
    })

    return MaterialRequest(**serialize_doc(created))


@router.get("/material-requests")
async def material_requests(params=Depends(list_params), status_filter: str | None = None, priority: str | None = None, current_user=Depends(get_current_user), db=Depends(get_database)):
    skip, limit, search, sort_by, sort_dir = params
    filters = {}
    # Vendors only see procurement requests assigned to their own vendor record.
    if current_user.get("role") == "vendor":
        vendor_id = current_user.get("vendor_id")
        if not vendor_id:
            raise HTTPException(status_code=403, detail="Account is not linked to a vendor record")
        filters["$or"] = [{"vendor_id": str(vendor_id)}, {"assigned_vendor_id": str(vendor_id)}]
    if status_filter:
        filters["status"] = status_filter
    if priority:
        filters["priority"] = priority
    return page(await list_docs(db, "material_requests", skip, limit, search, ["request_id", "project", "material_name", "status"], filters or None, sort_by, sort_dir))


@router.get("/material-requests/{request_id}", response_model=MaterialRequest)
async def get_request(request_id: str, current_user=Depends(get_current_user), db=Depends(get_database)):
    doc = await get_doc(db, "material_requests", request_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Material request not found")
    return MaterialRequest(**serialize_doc(doc))


@router.put("/material-requests/{request_id}", response_model=MaterialRequest)
async def edit_request(request_id: str, request: MaterialRequestUpdate, current_user=Depends(get_current_user), db=Depends(get_database)):
    require_role(current_user, "site_engineer")
    doc = await update_doc(db, "material_requests", request_id, request.model_dump(exclude_unset=True), current_user)
    if not doc:
        raise HTTPException(status_code=404, detail="Material request not found")
    return MaterialRequest(**serialize_doc(doc))


@router.patch("/material-requests/{request_id}/approval", response_model=MaterialRequest)
async def approve_request(request_id: str, action: ApprovalAction, current_user=Depends(get_current_user), db=Depends(get_database)):
    require_role(current_user, "project_manager")
    doc = await approve_material_request(db, request_id, action.status, action.comments, current_user)
    if not doc:
        raise HTTPException(status_code=404, detail="Material request not found")

    target_user = doc.get("requested_by") or str(current_user["_id"])
    req_no = doc.get("request_id", request_id)
    await create_notification(db, {
        "user_id": str(target_user),
        "title": f"Material Request {action.status.capitalize()}",
        "message": f"Material request '{req_no}' has been {action.status}.",
        "type": "success" if action.status == "approved" else "alert",
        "category": "procurement_alert",
        "entity_type": "procurement",
        "entity_id": request_id,
    })

    return MaterialRequest(**serialize_doc(doc))


@router.put("/material-requests/{request_id}/assign-vendor", response_model=MaterialRequest)
async def assign_vendor(request_id: str, assignment: VendorAssignment, current_user=Depends(get_current_user), db=Depends(get_database)):
    require_role(current_user, "project_manager")
    doc, error = await assign_vendor_to_material_request(db, request_id, assignment.vendor_id, current_user)
    if error:
        status_code = 404 if error in {"Material request not found", "Vendor not found"} else 400
        raise HTTPException(status_code=status_code, detail=error)

    req_no = doc.get("request_id", request_id)
    await create_notification(db, {
        "user_id": str(current_user["_id"]),
        "title": "Vendor Assigned",
        "message": f"Vendor assigned to material request '{req_no}'.",
        "type": "success",
        "category": "procurement_alert",
        "entity_type": "procurement",
        "entity_id": request_id,
    })
    if doc.get("vendor_id"):
        await notify_vendor_user(db, str(doc["vendor_id"]), {
            "title": "New Procurement Request",
            "message": f"A material request '{req_no}' has been assigned to you. Please review and respond.",
            "type": "info",
            "category": "procurement_alert",
            "entity_type": "procurement",
            "entity_id": request_id,
        })
    return MaterialRequest(**serialize_doc(doc))


@router.get("/materials", response_model=list[MaterialItem])
async def materials(current_user=Depends(get_current_user), db=Depends(get_database)):
    """List available materials from the inventory master (with stock + unit)."""
    docs = await list_materials_from_inventory(db)
    items = []
    for d in docs:
        d = dict(d)
        d["_id"] = str(d["_id"])
        d["material"] = d.get("material") or d.get("material_name") or "Unnamed Item"
        try:
            d["available_stock"] = float(d.get("stock_quantity") or d.get("quantity") or 0)
        except (TypeError, ValueError):
            d["available_stock"] = 0
        d.setdefault("material_name", d["material"])
        d.setdefault("unit", "Nos")
        d.setdefault("status", d.get("status") or "in_stock")
        items.append(MaterialItem(**d))
    return items


@router.post("/material-requests/{request_id}/vendor-accept", response_model=MaterialRequest)
async def vendor_accept(request_id: str, current_user=Depends(get_current_user), db=Depends(get_database)):
    require_vendor(current_user)
    doc, error = await vendor_respond_to_request(db, request_id, "accept", None, current_user)
    if error:
        raise HTTPException(status_code=400, detail=error)
    await create_notification(db, {
        "user_id": str(current_user["_id"]),
        "title": "Request Accepted",
        "message": f"Vendor accepted procurement request '{doc.get('request_id', request_id)}'.",
        "type": "success",
        "category": "procurement_alert",
        "entity_type": "procurement",
        "entity_id": request_id,
    })
    return MaterialRequest(**serialize_doc(doc))


@router.post("/material-requests/{request_id}/vendor-reject", response_model=MaterialRequest)
async def vendor_reject(request_id: str, payload: VendorResponseAction, current_user=Depends(get_current_user), db=Depends(get_database)):
    require_vendor(current_user)
    doc, error = await vendor_respond_to_request(db, request_id, "reject", payload.comment, current_user)
    if error:
        raise HTTPException(status_code=400, detail=error)
    await create_notification(db, {
        "user_id": str(current_user["_id"]),
        "title": "Request Rejected",
        "message": f"Vendor rejected procurement request '{doc.get('request_id', request_id)}'. Reason: {payload.comment or 'N/A'}",
        "type": "warning",
        "category": "procurement_alert",
        "entity_type": "procurement",
        "entity_id": request_id,
    })
    return MaterialRequest(**serialize_doc(doc))


@router.get("/vendor/dashboard", response_model=VendorDashboardStats)
async def vendor_dashboard(current_user=Depends(get_current_user), db=Depends(get_database)):
    vendor_id = require_vendor(current_user)
    stats = await vendor_dashboard_stats(db, vendor_id)

    def ser(d):
        return serialize(dict(d))

    return VendorDashboardStats(
        vendor=ser(stats["vendor"]) if stats.get("vendor") else None,
        total_assigned=stats["total_assigned"],
        pending_responses=stats["pending_responses"],
        accepted_requests=stats["accepted_requests"],
        rejected_requests=stats["rejected_requests"],
        total_purchase_orders=stats["total_purchase_orders"],
        pending_deliveries=stats["pending_deliveries"],
        pending_payments=stats["pending_payments"],
        requests=[MaterialRequest(**ser(r)) for r in stats["requests"]],
        purchase_orders=[PurchaseOrder(**ser(po)) for po in stats["purchase_orders"]],
    )


@router.get("/inventory/history")
async def inventory_history(material_id: str | None = Query(None), current_user=Depends(get_current_user), db=Depends(get_database)):
    history = await get_inventory_history(db, material_id)
    return serialize(history)


@router.delete("/material-requests/{request_id}")
async def remove_request(request_id: str, current_user=Depends(get_current_user), db=Depends(get_database)):
    require_role(current_user, "admin")
    if not await delete_doc(db, "material_requests", request_id, current_user):
        raise HTTPException(status_code=404, detail="Material request not found")
    return {"message": "Material request deleted successfully"}


@router.post("/purchase-orders", response_model=PurchaseOrder)
async def create_po(po: PurchaseOrderCreate, current_user=Depends(get_current_user), db=Depends(get_database)):
    require_role(current_user, "project_manager")
    doc, error = await create_purchase_order_from_request(db, po.model_dump(), current_user)
    if error:
        raise HTTPException(status_code=400, detail=error)

    po_id = str(doc["_id"])
    po_no = doc.get("po_number", po_id)
    await create_notification(db, {
        "user_id": str(current_user["_id"]),
        "title": "Purchase Order Created",
        "message": f"Purchase Order '{po_no}' created for project '{doc.get('project', '')}'.",
        "type": "success",
        "category": "procurement_alert",
        "entity_type": "procurement",
        "entity_id": po_id,
    })
    if doc.get("vendor_id"):
        await notify_vendor_user(db, str(doc["vendor_id"]), {
            "title": "Purchase Order Generated",
            "message": f"A purchase order '{po_no}' has been generated for your accepted request.",
            "type": "success",
            "category": "procurement_alert",
            "entity_type": "procurement",
            "entity_id": po_id,
        })

    return PurchaseOrder(**serialize_doc(doc))


async def list_purchase_orders(db, skip: int = 0, limit: int = 10):
    res = await list_docs(db, "purchase_orders", skip, limit)
    return res["items"]


async def list_invoices(db, skip: int = 0, limit: int = 10):
    res = await list_docs(db, "invoices", skip, limit)
    return res["items"]


@router.get("/purchase-orders")
async def purchase_orders(params=Depends(list_params), status_filter: str | None = None, current_user=Depends(get_current_user), db=Depends(get_database)):
    skip, limit, search, sort_by, sort_dir = params
    filters = {}
    if current_user.get("role") == "vendor":
        vendor_id = current_user.get("vendor_id")
        if not vendor_id:
            raise HTTPException(status_code=403, detail="Account is not linked to a vendor record")
        filters["vendor_id"] = str(vendor_id)
    if status_filter:
        filters["status"] = status_filter
    return page(await list_docs(db, "purchase_orders", skip, limit, search, ["po_number", "project", "materials", "status"], filters or None, sort_by, sort_dir))


@router.get("/invoices")
async def invoices(params=Depends(list_params), status_filter: str | None = None, current_user=Depends(get_current_user), db=Depends(get_database)):
    skip, limit, search, sort_by, sort_dir = params
    if search or status_filter:
        filters = {"status": status_filter} if status_filter else None
        return page(await list_docs(db, "invoices", skip, limit, search, ["invoice_number", "status", "payment_status"], filters, sort_by, sort_dir))
    res = await list_invoices(db, skip, limit)
    if isinstance(res, list):
        return [serialize_doc(item) for item in res]
    return page(res)


@router.get("/purchase-orders/{po_id}", response_model=PurchaseOrder)
async def get_po(po_id: str, current_user=Depends(get_current_user), db=Depends(get_database)):
    doc = await get_doc(db, "purchase_orders", po_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    return PurchaseOrder(**serialize_doc(doc))


@router.put("/purchase-orders/{po_id}", response_model=PurchaseOrder)
async def edit_po(po_id: str, po: PurchaseOrderUpdate, current_user=Depends(get_current_user), db=Depends(get_database)):
    require_role(current_user, "project_manager")
    doc = await update_purchase_order(db, po_id, po.model_dump(exclude_unset=True), current_user)
    if not doc:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    return PurchaseOrder(**serialize_doc(doc))


@router.patch("/purchase-orders/{po_id}/status", response_model=PurchaseOrder)
async def change_po_status(po_id: str, po: PurchaseOrderUpdate, current_user=Depends(get_current_user), db=Depends(get_database)):
    require_role(current_user, "project_manager")
    if not po.status:
        raise HTTPException(status_code=400, detail="Status is required")
    doc = await update_purchase_order(db, po_id, {"status": po.status}, current_user)
    if not doc:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    return PurchaseOrder(**serialize_doc(doc))


@router.put("/purchase-orders/{po_id}/send", response_model=PurchaseOrder)
async def send_po(po_id: str, current_user=Depends(get_current_user), db=Depends(get_database)):
    require_role(current_user, "project_manager")
    existing = await get_doc(db, "purchase_orders", po_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    if not existing.get("vendor_id"):
        raise HTTPException(status_code=400, detail="Cannot send purchase order without an assigned vendor")
    doc = await update_purchase_order(db, po_id, {"status": "sent"}, current_user)
    request_id = doc.get("request_id")
    po_no = doc.get("po_number", po_id)
    if request_id:
        await update_doc(db, "material_requests", request_id, {"status": "po_sent"}, current_user)
    if doc.get("vendor_id"):
        await notify_vendor_user(db, str(doc["vendor_id"]), {
            "title": "Purchase Order Sent",
            "message": f"Purchase Order '{po_no}' has been sent to you. Please confirm.",
            "type": "info",
            "category": "procurement_alert",
            "entity_type": "procurement",
            "entity_id": po_id,
        })
    return PurchaseOrder(**serialize_doc(doc))


@router.put("/purchase-orders/{po_id}/accept", response_model=PurchaseOrder)
async def vendor_accept_po(po_id: str, current_user=Depends(get_current_user), db=Depends(get_database)):
    """Vendor confirms the purchase order."""
    vendor_id = require_vendor(current_user)
    existing = await get_doc(db, "purchase_orders", po_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    if str(existing.get("vendor_id") or "") != vendor_id:
        raise HTTPException(status_code=403, detail="You are not the vendor for this purchase order")
    if existing.get("status") not in {"created", "sent"}:
        raise HTTPException(status_code=400, detail="Purchase order is not in a confirmable state")
    doc = await update_purchase_order(db, po_id, {"status": "accepted"}, current_user)
    request_id = doc.get("request_id")
    if request_id:
        await update_doc(db, "material_requests", request_id, {"status": "po_accepted"}, current_user)
    return PurchaseOrder(**serialize_doc(doc))


@router.get("/purchase-orders/{po_id}/pdf")
async def po_pdf(po_id: str, current_user=Depends(get_current_user), db=Depends(get_database)):
    doc = await get_doc(db, "purchase_orders", po_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    vendor = await get_doc(db, "vendors", doc.get("vendor_id", "")) if doc.get("vendor_id") else None

    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=letter)
    draw_document_template(pdf, title="PURCHASE ORDER", number=doc.get("po_number", po_id), accent=colors.HexColor("#2563eb"))

    pdf.setFillColor(colors.HexColor("#111827"))
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(56, 606, "Date:")
    pdf.setFont("Helvetica", 10)
    pdf.drawString(92, 606, short_date(doc.get("created_at")))

    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(56, 560, "Vendor:")
    pdf.setFont("Helvetica", 10)
    pdf.drawString(56, 544, vendor.get("vendor_name", "-") if vendor else doc.get("vendor_id", "-"))
    pdf.drawString(56, 530, vendor.get("contact_person", "-") if vendor else "-")
    pdf.drawString(56, 516, vendor.get("email", "-") if vendor else "-")
    pdf.drawString(56, 502, vendor.get("phone", "-") if vendor else "-")

    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(320, 560, "Project:")
    pdf.setFont("Helvetica", 10)
    pdf.drawString(320, 544, doc.get("project", "-"))
    pdf.drawString(320, 530, f"Request: {doc.get('request_id', '-')}")
    pdf.drawString(320, 516, f"Expected: {short_date(doc.get('expected_delivery_date'))}")
    pdf.drawString(320, 502, f"Status: {doc.get('status', '-')}")

    draw_table_header(pdf, 398, [("Item", 68), ("Quantity", 292), ("Unit Price", 382), ("Amount", 490)])
    quantity = float(doc.get("quantity", 0) or 0)
    unit_price = float(doc.get("unit_price", 0) or 0)
    total = float(doc.get("total_cost", quantity * unit_price) or 0)
    pdf.setFont("Helvetica", 10)
    pdf.drawString(68, 366, doc.get("materials", "-"))
    pdf.drawRightString(330, 366, f"{quantity:g}")
    pdf.drawRightString(432, 366, money(unit_price))
    pdf.drawRightString(552, 366, money(total))
    draw_total_row(pdf, 322, "Total", money(total))

    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(56, 266, "Note:")
    pdf.setFont("Helvetica", 10)
    pdf.drawString(92, 266, "Please supply materials as per approved request and expected delivery date.")
    pdf.showPage()
    pdf.save()
    buffer.seek(0)
    return StreamingResponse(buffer, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename={doc['po_number']}.pdf"})


@router.delete("/purchase-orders/{po_id}")
async def remove_po(po_id: str, current_user=Depends(get_current_user), db=Depends(get_database)):
    require_role(current_user, "admin")
    if not await delete_doc(db, "purchase_orders", po_id, current_user):
        raise HTTPException(status_code=404, detail="Purchase order not found")
    return {"message": "Purchase order deleted successfully"}


@router.post("/deliveries", response_model=Delivery)
async def create_delivery(delivery: DeliveryCreate, current_user=Depends(get_current_user), db=Depends(get_database)):
    require_role(current_user, "store_manager")
    doc = await create_delivery_and_inventory(db, delivery.model_dump(), current_user)
    d_id = str(doc["_id"])

    await create_notification(db, {
        "user_id": str(current_user["_id"]),
        "title": "Delivery Received",
        "message": f"Delivery for '{doc.get('material', 'materials')}' received and inventory updated.",
        "type": "success",
        "category": "procurement_alert",
        "entity_type": "procurement",
        "entity_id": d_id,
    })

    return Delivery(**serialize_doc(doc))



@router.get("/deliveries")
async def deliveries(params=Depends(list_params), status_filter: str | None = None, current_user=Depends(get_current_user), db=Depends(get_database)):
    skip, limit, search, sort_by, sort_dir = params
    filters = {"status": status_filter} if status_filter else None
    return page(await list_docs(db, "deliveries", skip, limit, search, ["material", "status", "quality_status"], filters, sort_by, sort_dir))


@router.put("/deliveries/{delivery_id}", response_model=Delivery)
async def edit_delivery(delivery_id: str, delivery: DeliveryUpdate, current_user=Depends(get_current_user), db=Depends(get_database)):
    require_role(current_user, "store_manager")
    doc = await update_doc(db, "deliveries", delivery_id, delivery.model_dump(exclude_unset=True), current_user)
    if not doc:
        raise HTTPException(status_code=404, detail="Delivery not found")
    return Delivery(**serialize_doc(doc))


@router.get("/inventory")
async def inventory(params=Depends(list_params), current_user=Depends(get_current_user), db=Depends(get_database)):
    skip, limit, search, sort_by, sort_dir = params

    # Read the full inventory collection (source of truth used by the inventory
    # page) and normalise every document, regardless of whether it was created by
    # the inventory module (material_name/quantity) or by a procurement delivery
    # (material/stock_quantity). Records for the same material are merged so the
    # screen always reflects the actual, up-to-date stock.
    raw = await db.inventory.find().to_list(100000)
    merged: dict[str, dict] = {}
    for item in raw:
        norm = normalize_inventory(item)
        key = (norm["material"] or "").strip().lower()
        existing = merged.get(key)
        if existing is None:
            merged[key] = norm
        else:
            existing["transactions"].extend(norm["transactions"])
            # Keep the most recently updated stock as the accurate figure.
            if norm["updated_at"] and (not existing.get("updated_at") or norm["updated_at"] > existing.get("updated_at")):
                existing["stock_quantity"] = norm["stock_quantity"]
                existing["updated_at"] = norm["updated_at"]

    items = list(merged.values())
    if search:
        term = search.lower()
        items = [it for it in items if term in (it["material"] or "").lower()]

    def inv_sort_key(item: dict):
        if sort_by == "material":
            return (item.get("material") or "").lower()
        return item.get(sort_by) or 0

    items.sort(key=inv_sort_key, reverse=(sort_dir == -1))
    total = len(items)
    paged = items[skip:skip + limit]
    return {"items": paged, "total": total}


@router.post("/invoices", response_model=Invoice)
async def create_invoice(invoice: InvoiceCreate, current_user=Depends(get_current_user), db=Depends(get_database)):
    return Invoice(**serialize_doc(await create_doc(db, "invoices", invoice.model_dump(), current_user)))


@router.post("/invoices/upload")
async def upload_invoice_attachment(file: UploadFile = File(...), current_user=Depends(get_current_user)):
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    safe_name = Path(file.filename or "invoice_attachment").name.replace("\\", "_").replace("/", "_")
    content = await file.read()
    path = UPLOAD_DIR / f"{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}_{safe_name}"
    with path.open("wb") as uploaded:
        uploaded.write(content)
    return {"attachment_url": str(path.relative_to(BASE_DIR)).replace("\\", "/")}


@router.get("/invoices/{invoice_id}/pdf")
async def invoice_pdf(invoice_id: str, current_user=Depends(get_current_user), db=Depends(get_database)):
    invoice = await get_doc(db, "invoices", invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    vendor = await get_doc(db, "vendors", invoice.get("vendor_id", "")) if invoice.get("vendor_id") else None
    po = await get_doc(db, "purchase_orders", invoice.get("purchase_order_id", "")) if invoice.get("purchase_order_id") else None

    amount = float(invoice.get("amount", 0) or 0)
    gst = float(invoice.get("gst", 0) or 0)
    total = amount + gst

    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=letter)
    accent_violet = colors.HexColor("#7c3aed")
    draw_document_template(pdf, title="INVOICE", number=invoice.get("invoice_number", invoice_id), accent=accent_violet)

    pdf.setFillColor(colors.HexColor("#111827"))
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(56, 606, "Invoice Date:")
    pdf.setFont("Helvetica", 10)
    pdf.drawString(118, 606, short_date(invoice.get("invoice_date")))

    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(56, 560, "Vendor:")
    pdf.setFont("Helvetica", 10)
    pdf.drawString(56, 544, vendor.get("vendor_name", "-") if vendor else invoice.get("vendor_id", "-"))
    pdf.drawString(56, 530, vendor.get("contact_person", "-") if vendor else "-")
    pdf.drawString(56, 516, vendor.get("email", "-") if vendor else "-")
    pdf.drawString(56, 502, vendor.get("phone", "-") if vendor else "-")

    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(320, 560, "Billed To / Project:")
    pdf.setFont("Helvetica", 10)
    pdf.drawString(320, 544, po.get("project", "-") if po else "BuildTrack Project")
    pdf.drawString(320, 530, f"PO Ref: {po.get('po_number', '-') if po else invoice.get('purchase_order_id', '-')}")
    pdf.drawString(320, 516, f"Materials: {po.get('materials', '-') if po else '-'}")
    pdf.drawString(320, 502, f"Payment Status: {str(invoice.get('payment_status', 'pending')).upper()}")

    draw_table_header(pdf, 398, [("Item", 68), ("Quantity", 292), ("Unit Price", 382), ("Amount", 490)])
    quantity = float(po.get("quantity", 1) or 1) if po else 1.0
    unit_price = amount / quantity if quantity > 0 else amount

    pdf.setFont("Helvetica", 10)
    item_title = po.get("materials", "Invoice Item(s)") if po else "Base Invoice Amount"
    pdf.drawString(68, 366, item_title)
    pdf.drawRightString(330, 366, f"{quantity:g}")
    pdf.drawRightString(432, 366, money(unit_price))
    pdf.drawRightString(552, 366, money(amount))

    if gst > 0:
        pdf.drawString(68, 342, "GST / Applicable Tax")
        pdf.drawRightString(330, 342, "1")
        pdf.drawRightString(432, 342, money(gst))
        pdf.drawRightString(552, 342, money(gst))
        draw_total_row(pdf, 304, "Grand Total", money(total))
    else:
        draw_total_row(pdf, 322, "Grand Total", money(total))

    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(56, 266, "Verification:")
    pdf.setFont("Helvetica", 10)
    pdf.drawString(132, 266, f"Status: {str(invoice.get('status', 'pending')).upper()}")
    if invoice.get("verification_comments"):
        pdf.setFont("Helvetica", 9)
        pdf.drawString(56, 250, f"Comments: {invoice.get('verification_comments')}")

    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(56, 212, "Note:")
    pdf.setFont("Helvetica", 10)
    pdf.drawString(92, 212, "This invoice is subject to BuildTrack procurement approval and verified delivery inspection.")

    pdf.showPage()
    pdf.save()
    buffer.seek(0)
    safe_number = str(invoice.get("invoice_number", "invoice")).replace("/", "_").replace("\\", "_")
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_number}.pdf"'}
    )


@router.put("/invoices/{invoice_id}", response_model=Invoice)
async def edit_invoice(invoice_id: str, invoice: InvoiceUpdate, current_user=Depends(get_current_user), db=Depends(get_database)):
    doc = await update_doc(db, "invoices", invoice_id, invoice.model_dump(exclude_unset=True), current_user)
    if not doc:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return Invoice(**serialize_doc(doc))


@router.delete("/invoices/{invoice_id}")
async def remove_invoice(invoice_id: str, current_user=Depends(get_current_user), db=Depends(get_database)):
    require_role(current_user, "admin")
    if not await delete_doc(db, "invoices", invoice_id, current_user):
        raise HTTPException(status_code=404, detail="Invoice not found")
    return {"message": "Invoice deleted successfully"}


@router.patch("/invoices/{invoice_id}/{action}", response_model=Invoice)
async def invoice_action(invoice_id: str, action: str, payload: InvoiceAction, current_user=Depends(get_current_user), db=Depends(get_database)):
    require_role(current_user, "finance")
    if action not in {"verify", "approve", "reject"}:
        raise HTTPException(status_code=400, detail="Action must be verify, approve, or reject")
    status_map = {"verify": "verified", "approve": "approved", "reject": "rejected"}
    doc = await update_invoice_status(db, invoice_id, status_map[action], current_user, payload.comments)
    if not doc:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return Invoice(**serialize_doc(doc))


@router.post("/payments", response_model=Payment)
async def create_payment(payment: PaymentCreate, current_user=Depends(get_current_user), db=Depends(get_database)):
    require_role(current_user, "finance")
    doc, error = await create_payment_for_invoice(db, payment.model_dump(), current_user)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return Payment(**serialize_doc(doc))


@router.get("/payments")
async def payments(params=Depends(list_params), status_filter: str | None = None, current_user=Depends(get_current_user), db=Depends(get_database)):
    skip, limit, search, sort_by, sort_dir = params
    filters = {"status": status_filter} if status_filter else None
    return page(await list_docs(db, "payments", skip, limit, search, ["status", "remarks"], filters, sort_by, sort_dir))


@router.put("/payments/{payment_id}", response_model=Payment)
async def edit_payment(payment_id: str, payment: PaymentUpdate, current_user=Depends(get_current_user), db=Depends(get_database)):
    require_role(current_user, "finance")
    data = payment.model_dump(exclude_unset=True)
    if data.get("status") == "paid" and not data.get("paid_at"):
        data["paid_at"] = datetime.utcnow()
    doc = await update_doc(db, "payments", payment_id, data, current_user)
    if not doc:
        raise HTTPException(status_code=404, detail="Payment not found")
    if data.get("status") == "paid":
        await update_doc(db, "invoices", doc["invoice_id"], {"payment_status": "paid"}, current_user)
    return Payment(**serialize_doc(doc))


@router.get("/export/{collection}")
async def export_collection(collection: str, current_user=Depends(get_current_user), db=Depends(get_database)):
    allowed = {"vendors", "material_requests", "purchase_orders", "deliveries", "inventory", "invoices", "payments"}
    if collection not in allowed:
        raise HTTPException(status_code=400, detail="Unsupported export collection")
    records = await db[collection].find().to_list(10000)
    output = io.StringIO()
    fields = sorted({key for record in records for key in record.keys()}) if records else ["message"]
    writer = csv.DictWriter(output, fieldnames=fields, extrasaction="ignore")
    writer.writeheader()
    for record in records:
        writer.writerow({key: serialize(record.get(key)) for key in fields})
    output.seek(0)
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename={collection}.csv"})
