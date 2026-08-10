import csv
import io
from datetime import datetime

from bson import ObjectId
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

from app.core.security import get_current_user
from app.db.mongodb import get_database
from app.modules.notifications.db import create_notification
from app.modules.procurement.db import (
    approve_material_request,
    create_delivery_and_inventory,
    create_doc,
    create_material_request,
    create_payment_for_invoice,
    create_purchase_order_from_request,
    dashboard_stats,
    delete_doc,
    get_doc,
    list_docs,
    update_doc,
    update_invoice_status,
    update_purchase_order,
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
    VendorCreate,
    VendorUpdate,
)

router = APIRouter()


ROLE_GROUPS = {
    "admin": {"admin"},
    "project_manager": {"admin", "manager"},
    "site_engineer": {"admin", "manager", "engineer"},
    "store_manager": {"admin", "store_manager", "store manager"},
    "finance": {"admin", "finance"},
}


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


@router.get("/dashboard", response_model=DashboardStats)
async def dashboard(current_user=Depends(get_current_user), db=Depends(get_database)):
    return serialize_doc(await dashboard_stats(db))


@router.post("/vendors", response_model=Vendor)
async def create_vendor(vendor: VendorCreate, current_user=Depends(get_current_user), db=Depends(get_database)):
    require_role(current_user, "project_manager")
    return Vendor(**serialize_doc(await create_doc(db, "vendors", vendor.model_dump(), current_user)))


@router.get("/vendors")
async def vendors(params=Depends(list_params), status_filter: str | None = None, current_user=Depends(get_current_user), db=Depends(get_database)):
    skip, limit, search, sort_by, sort_dir = params
    filters = {"status": status_filter} if status_filter else None
    return page(await list_docs(db, "vendors", skip, limit, search, ["vendor_name", "contact_person", "email", "phone"], filters, sort_by, sort_dir))


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
    created = await create_material_request(db, request.model_dump(), current_user)
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
    if search or status_filter:
        filters = {"status": status_filter} if status_filter else None
        return page(await list_docs(db, "purchase_orders", skip, limit, search, ["po_number", "project", "materials", "status"], filters, sort_by, sort_dir))
    res = await list_purchase_orders(db, skip, limit)
    if isinstance(res, list):
        return [serialize_doc(item) for item in res]
    return page(res)


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


@router.get("/purchase-orders/{po_id}/pdf")
async def po_pdf(po_id: str, current_user=Depends(get_current_user), db=Depends(get_database)):
    doc = await get_doc(db, "purchase_orders", po_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=letter)
    pdf.drawString(72, 740, f"Purchase Order: {doc['po_number']}")
    pdf.drawString(72, 710, f"Project: {doc['project']}")
    pdf.drawString(72, 690, f"Materials: {doc['materials']}")
    pdf.drawString(72, 670, f"Quantity: {doc['quantity']} @ {doc['unit_price']}")
    pdf.drawString(72, 650, f"Total Cost: {doc['total_cost']}")
    pdf.drawString(72, 630, f"Status: {doc['status']}")
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
    return page(await list_docs(db, "inventory", skip, limit, search, ["material"], None, sort_by, sort_dir))


@router.post("/invoices", response_model=Invoice)
async def create_invoice(invoice: InvoiceCreate, current_user=Depends(get_current_user), db=Depends(get_database)):
    return Invoice(**serialize_doc(await create_doc(db, "invoices", invoice.model_dump(), current_user)))


@router.post("/invoices/upload")
async def upload_invoice_attachment(file: UploadFile = File(...), current_user=Depends(get_current_user)):
    safe_name = file.filename.replace("\\", "_").replace("/", "_")
    content = await file.read()
    path = f"uploads/{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{safe_name}"
    with open(path, "wb") as uploaded:
        uploaded.write(content)
    return {"attachment_url": path}


@router.put("/invoices/{invoice_id}", response_model=Invoice)
async def edit_invoice(invoice_id: str, invoice: InvoiceUpdate, current_user=Depends(get_current_user), db=Depends(get_database)):
    doc = await update_doc(db, "invoices", invoice_id, invoice.model_dump(exclude_unset=True), current_user)
    if not doc:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return Invoice(**serialize_doc(doc))


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
