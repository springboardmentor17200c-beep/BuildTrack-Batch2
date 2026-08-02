from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime

from app.core.security import get_current_user
from app.db.mongodb import get_database
from app.modules.procurement.db import (
    create_invoice,
    create_purchase_order,
    create_procurement,
    create_vendor,
    delete_invoice,
    delete_purchase_order,
    delete_vendor,
    get_invoice,
    get_purchase_order,
    delete_procurement,
    get_procurement,
    get_procurement_by_status,
    get_procurements_by_project,
    get_procurements_by_vendor,
    get_vendor,
    get_vendors_by_rating,
    list_invoices,
    list_purchase_orders,
    list_procurements,
    list_vendors,
    search_vendors,
    update_invoice,
    update_purchase_order,
    update_procurement,
    update_vendor,
)
from app.modules.procurement.models import (
    Invoice,
    InvoiceCreate,
    InvoiceUpdate,
    PurchaseOrder,
    PurchaseOrderCreate,
    PurchaseOrderUpdate,
    Procurement,
    ProcurementCreate,
    ProcurementUpdate,
    Vendor,
    VendorCreate,
    VendorUpdate,
)
router = APIRouter()


def serialize_doc(doc: dict) -> dict:
    """Convert MongoDB's ObjectId _id field to a string so Pydantic models validate correctly."""
    doc = dict(doc)  # avoid mutating the original dict
    if "_id" in doc:
        doc["_id"] = str(doc["_id"])
    doc.setdefault("vendor_id", doc.get("vendorId") or doc.get("supplierName") or doc.get("supplier") or "supplier")
    doc.setdefault("project_id", doc.get("projectId"))
    if "items" not in doc:
        quantity = doc.get("quantity") or 1
        unit_price = doc.get("unitPrice") or doc.get("amount") or 0
        doc["items"] = [
            {
                "item_name": doc.get("materialName") or doc.get("itemsSummary") or "Procurement item",
                "quantity": quantity,
                "unit_price": unit_price,
                "total_cost": doc.get("totalAmount") or doc.get("amount") or quantity * unit_price,
            }
        ]
    doc.setdefault("requested_by", doc.get("requestedBy") or "frontend")
    doc.setdefault("request_date", doc.get("requestDate") or doc.get("purchaseDate") or datetime.utcnow())
    doc.setdefault("expected_delivery", doc.get("expectedDelivery") or doc.get("deliveryDate"))
    doc.setdefault("status", doc.get("status") or "pending")
    doc.setdefault("total_amount", doc.get("totalAmount") or doc.get("amount") or 0)
    doc.setdefault("notes", doc.get("remarks") or doc.get("poNo"))
    doc.setdefault("created_at", doc.get("createdAt") or datetime.utcnow())
    doc.setdefault("updated_at", doc.get("updatedAt") or datetime.utcnow())
    return doc


# Vendor endpoints
@router.post("/vendors", response_model=Vendor)
async def create_vendor_endpoint(
    vendor: VendorCreate,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Create new vendor"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin or manager can create vendors",
        )

    vendor_data = vendor.model_dump()
    result = await create_vendor(db, vendor_data)
    return Vendor(**serialize_doc(result))


@router.get("/vendors", response_model=list[Vendor])
async def list_vendors_endpoint(
    skip: int = 0,
    limit: int = 10,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """List all vendors"""
    vendors = await list_vendors(db, skip, limit)
    return [Vendor(**serialize_doc(v)) for v in vendors]


@router.get("/vendors/{vendor_id}", response_model=Vendor)
async def get_vendor_endpoint(
    vendor_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get vendor by ID"""
    vendor = await get_vendor(db, vendor_id)
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found",
        )
    return Vendor(**serialize_doc(vendor))


@router.put("/vendors/{vendor_id}", response_model=Vendor)
async def update_vendor_endpoint(
    vendor_id: str,
    update: VendorUpdate,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Update vendor"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin or manager can update vendors",
        )

    vendor = await get_vendor(db, vendor_id)
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found",
        )

    result = await update_vendor(db, vendor_id, update.model_dump(exclude_unset=True))
    return Vendor(**serialize_doc(result))


@router.delete("/vendors/{vendor_id}")
async def delete_vendor_endpoint(
    vendor_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Delete vendor"""
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin can delete vendors",
        )

    deleted = await delete_vendor(db, vendor_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found",
        )
    return {"message": "Vendor deleted successfully"}


# Supplier management aliases (same data source as vendors)
@router.post("/suppliers", response_model=Vendor)
async def create_supplier_endpoint(
    supplier: VendorCreate,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    return await create_vendor_endpoint(supplier, current_user, db)


@router.get("/suppliers", response_model=list[Vendor])
async def list_suppliers_endpoint(
    skip: int = 0,
    limit: int = 10,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    return await list_vendors_endpoint(skip, limit, current_user, db)


@router.get("/suppliers/{supplier_id}", response_model=Vendor)
async def get_supplier_endpoint(
    supplier_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    return await get_vendor_endpoint(supplier_id, current_user, db)


@router.put("/suppliers/{supplier_id}", response_model=Vendor)
async def update_supplier_endpoint(
    supplier_id: str,
    update: VendorUpdate,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    return await update_vendor_endpoint(supplier_id, update, current_user, db)


@router.delete("/suppliers/{supplier_id}")
async def delete_supplier_endpoint(
    supplier_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    return await delete_vendor_endpoint(supplier_id, current_user, db)


# Procurement endpoints
@router.post("/", response_model=Procurement)
async def create_procurement_endpoint(
    procurement: ProcurementCreate,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Create new procurement order"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin or manager can create procurement orders",
        )

    procurement_data = procurement.model_dump()
    result = await create_procurement(db, procurement_data)
    return Procurement(**serialize_doc(result))


@router.get("/", response_model=list[Procurement])
async def list_procurements_endpoint(
    skip: int = 0,
    limit: int = 10,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """List all procurement orders"""
    procurements = await list_procurements(db, skip, limit)
    return [Procurement(**serialize_doc(p)) for p in procurements]


@router.get("/{procurement_id}", response_model=Procurement)
async def get_procurement_endpoint(
    procurement_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get procurement order by ID"""
    procurement = await get_procurement(db, procurement_id)
    if not procurement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Procurement order not found",
        )
    return Procurement(**serialize_doc(procurement))


@router.get("/status/{status}", response_model=list[Procurement])
async def get_procurements_by_status_endpoint(
    status: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get procurement orders by status"""
    procurements = await get_procurement_by_status(db, status)
    return [Procurement(**serialize_doc(p)) for p in procurements]


@router.get("/project/{project_id}", response_model=list[Procurement])
async def get_project_procurements(
    project_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get all procurement orders for a project"""
    procurements = await get_procurements_by_project(db, project_id)
    return [Procurement(**serialize_doc(p)) for p in procurements]


@router.get("/vendor/{vendor_id}", response_model=list[Procurement])
async def get_vendor_procurements(
    vendor_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get all procurement orders for a vendor"""
    procurements = await get_procurements_by_vendor(db, vendor_id)
    return [Procurement(**serialize_doc(p)) for p in procurements]


# Purchase Order APIs
@router.post("/purchase-orders", response_model=PurchaseOrder)
async def create_purchase_order_endpoint(
    purchase_order: PurchaseOrderCreate,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin or manager can create purchase orders",
        )

    result = await create_purchase_order(db, purchase_order.model_dump())
    return PurchaseOrder(**serialize_doc(result))


@router.get("/purchase-orders", response_model=list[PurchaseOrder])
async def list_purchase_orders_endpoint(
    skip: int = 0,
    limit: int = 10,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    orders = await list_purchase_orders(db, skip, limit)
    return [PurchaseOrder(**serialize_doc(order)) for order in orders]


@router.get("/purchase-orders/{po_id}", response_model=PurchaseOrder)
async def get_purchase_order_endpoint(
    po_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    purchase_order = await get_purchase_order(db, po_id)
    if not purchase_order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Purchase order not found",
        )
    return PurchaseOrder(**serialize_doc(purchase_order))


@router.put("/purchase-orders/{po_id}", response_model=PurchaseOrder)
async def update_purchase_order_endpoint(
    po_id: str,
    update: PurchaseOrderUpdate,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin or manager can update purchase orders",
        )

    purchase_order = await get_purchase_order(db, po_id)
    if not purchase_order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Purchase order not found",
        )

    result = await update_purchase_order(db, po_id, update.model_dump(exclude_unset=True))
    return PurchaseOrder(**serialize_doc(result))


@router.delete("/purchase-orders/{po_id}")
async def delete_purchase_order_endpoint(
    po_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin can delete purchase orders",
        )

    deleted = await delete_purchase_order(db, po_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Purchase order not found",
        )
    return {"message": "Purchase order deleted successfully"}


# Invoice tracking APIs
@router.post("/invoices", response_model=Invoice)
async def create_invoice_endpoint(
    invoice: InvoiceCreate,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin or manager can create invoices",
        )

    result = await create_invoice(db, invoice.model_dump())
    return Invoice(**serialize_doc(result))


@router.get("/invoices", response_model=list[Invoice])
async def list_invoices_endpoint(
    skip: int = 0,
    limit: int = 10,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    invoices = await list_invoices(db, skip, limit)
    return [Invoice(**serialize_doc(invoice)) for invoice in invoices]


@router.get("/invoices/{invoice_id}", response_model=Invoice)
async def get_invoice_endpoint(
    invoice_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    invoice = await get_invoice(db, invoice_id)
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )
    return Invoice(**serialize_doc(invoice))


@router.put("/invoices/{invoice_id}", response_model=Invoice)
async def update_invoice_endpoint(
    invoice_id: str,
    update: InvoiceUpdate,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin or manager can update invoices",
        )

    invoice = await get_invoice(db, invoice_id)
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )

    result = await update_invoice(db, invoice_id, update.model_dump(exclude_unset=True))
    return Invoice(**serialize_doc(result))


@router.delete("/invoices/{invoice_id}")
async def delete_invoice_endpoint(
    invoice_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin can delete invoices",
        )

    deleted = await delete_invoice(db, invoice_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )
    return {"message": "Invoice deleted successfully"}


@router.put("/{procurement_id}", response_model=Procurement)
async def update_procurement_endpoint(
    procurement_id: str,
    update: ProcurementUpdate,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Update procurement order"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin or manager can update procurement orders",
        )

    procurement = await get_procurement(db, procurement_id)
    if not procurement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Procurement order not found",
        )

    update_data = update.model_dump(exclude_unset=True)
    result = await update_procurement(db, procurement_id, update_data)
    return Procurement(**serialize_doc(result))


@router.delete("/{procurement_id}")
async def delete_procurement_endpoint(
    procurement_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Delete procurement order"""
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin can delete procurement orders",
        )

    deleted = await delete_procurement(db, procurement_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Procurement order not found",
        )
    return {"message": "Procurement order deleted successfully"}
