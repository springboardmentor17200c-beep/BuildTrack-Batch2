from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import get_current_user
from app.db.mongodb import get_database
from app.modules.invoice_tracking.db import (
    create_invoice,
    delete_invoice,
    get_invoice,
    get_invoices_by_project,
    get_invoices_by_status,
    get_invoices_by_vendor,
    list_invoices,
    update_invoice,
)
from app.modules.invoice_tracking.models import (
    Invoice,
    InvoiceCreate,
    InvoiceUpdate,
)

router = APIRouter()


def serialize_doc(doc: dict) -> dict:
    """Convert MongoDB ObjectId to string."""
    doc = dict(doc)
    if "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc


# =====================================================
# Create Invoice
# =====================================================

@router.post("/", response_model=Invoice)
async def create_invoice_endpoint(
    invoice: InvoiceCreate,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Create a new invoice"""

    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin or manager can create invoices",
        )

    invoice_data = invoice.model_dump()

    result = await create_invoice(db, invoice_data)

    return Invoice(**serialize_doc(result))


# =====================================================
# List Invoices
# =====================================================

@router.get("/", response_model=list[Invoice])
async def list_invoices_endpoint(
    skip: int = 0,
    limit: int = 10,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """List all invoices"""

    invoices = await list_invoices(db, skip, limit)

    return [
        Invoice(**serialize_doc(invoice))
        for invoice in invoices
    ]


# =====================================================
# Get Invoice
# =====================================================

@router.get("/{invoice_id}", response_model=Invoice)
async def get_invoice_endpoint(
    invoice_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get invoice by ID"""

    invoice = await get_invoice(db, invoice_id)

    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )

    return Invoice(**serialize_doc(invoice))


# =====================================================
# Update Invoice
# =====================================================

@router.put("/{invoice_id}", response_model=Invoice)
async def update_invoice_endpoint(
    invoice_id: str,
    update: InvoiceUpdate,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Update invoice"""

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

    update_data = update.model_dump(exclude_unset=True)

    result = await update_invoice(
        db,
        invoice_id,
        update_data,
    )

    return Invoice(**serialize_doc(result))


# =====================================================
# Delete Invoice
# =====================================================

@router.delete("/{invoice_id}")
async def delete_invoice_endpoint(
    invoice_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Delete invoice"""

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

    return {
        "message": "Invoice deleted successfully"
    }


# =====================================================
# Get Invoices by Project
# =====================================================

@router.get("/project/{project_id}", response_model=list[Invoice])
async def get_invoices_by_project_endpoint(
    project_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get invoices by project"""

    invoices = await get_invoices_by_project(
        db,
        project_id,
    )

    return [
        Invoice(**serialize_doc(invoice))
        for invoice in invoices
    ]


# =====================================================
# Get Invoices by Vendor
# =====================================================

@router.get("/vendor/{vendor_id}", response_model=list[Invoice])
async def get_invoices_by_vendor_endpoint(
    vendor_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get invoices by vendor"""

    invoices = await get_invoices_by_vendor(
        db,
        vendor_id,
    )

    return [
        Invoice(**serialize_doc(invoice))
        for invoice in invoices
    ]


# =====================================================
# Get Invoices by Status
# =====================================================

@router.get("/status/{status}", response_model=list[Invoice])
async def get_invoices_by_status_endpoint(
    status: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get invoices by status"""

    invoices = await get_invoices_by_status(
        db,
        status,
    )

    return [
        Invoice(**serialize_doc(invoice))
        for invoice in invoices
    ]