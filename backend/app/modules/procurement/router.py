from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import get_current_user
from app.db.mongodb import get_database
from app.modules.procurement.db import (
    create_procurement,
    create_vendor,
    delete_procurement,
    delete_vendor,
    get_procurement,
    get_procurement_by_status,
    get_procurements_by_project,
    get_procurements_by_vendor,
    get_vendor,
    get_vendors_by_rating,
    list_procurements,
    list_vendors,
    search_vendors,
    update_procurement,
    update_vendor,
)
from app.modules.procurement.models import (
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


@router.put("/vendors/{vendor_id}", response_model=Vendor)
async def update_vendor_endpoint(
    vendor_id: str,
    vendor: VendorUpdate,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Update vendor"""

    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin or manager can update vendors",
        )

    existing = await get_vendor(db, vendor_id)

    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found",
        )

    update_data = vendor.model_dump(exclude_unset=True)

    updated = await update_vendor(
        db,
        vendor_id,
        update_data,
    )

    return Vendor(**serialize_doc(updated))

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

    return {
        "message": "Vendor deleted successfully"
    }

@router.get("/vendors/search/{keyword}", response_model=list[Vendor])
async def search_vendor_endpoint(
    keyword: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Search vendors"""

    vendors = await search_vendors(
        db,
        keyword,
    )

    return [
        Vendor(**serialize_doc(v))
        for v in vendors
    ]

@router.get("/vendors/rating/{rating}", response_model=list[Vendor])
async def vendors_by_rating_endpoint(
    rating: float,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get vendors by minimum rating"""

    vendors = await get_vendors_by_rating(
        db,
        rating,
    )

    return [
        Vendor(**serialize_doc(v))
        for v in vendors
    ]

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