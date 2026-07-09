from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import get_current_user
from app.db.mongodb import get_database
from app.modules.procurement.db import (
    create_procurement,
    create_vendor,
    delete_procurement,
    get_procurement,
    get_procurement_by_status,
    get_procurements_by_project,
    get_procurements_by_vendor,
    get_vendor,
    list_procurements,
    list_vendors,
    update_procurement,
)
from app.modules.procurement.models import (
    Procurement,
    ProcurementCreate,
    ProcurementUpdate,
    Vendor,
    VendorCreate,
)

router = APIRouter()


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
    return Vendor(**result, id=str(result["_id"]))


@router.get("/vendors", response_model=list[Vendor])
async def list_vendors_endpoint(
    skip: int = 0,
    limit: int = 10,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """List all vendors"""
    vendors = await list_vendors(db, skip, limit)
    return [Vendor(**v, id=str(v["_id"])) for v in vendors]


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
    return Vendor(**vendor, id=str(vendor["_id"]))


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
    return Procurement(**result, id=str(result["_id"]))


@router.get("/", response_model=list[Procurement])
async def list_procurements_endpoint(
    skip: int = 0,
    limit: int = 10,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """List all procurement orders"""
    procurements = await list_procurements(db, skip, limit)
    return [Procurement(**p, id=str(p["_id"])) for p in procurements]


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
    return Procurement(**procurement, id=str(procurement["_id"]))


@router.get("/status/{status}", response_model=list[Procurement])
async def get_procurements_by_status_endpoint(
    status: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get procurement orders by status"""
    procurements = await get_procurement_by_status(db, status)
    return [Procurement(**p, id=str(p["_id"])) for p in procurements]


@router.get("/project/{project_id}", response_model=list[Procurement])
async def get_project_procurements(
    project_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get all procurement orders for a project"""
    procurements = await get_procurements_by_project(db, project_id)
    return [Procurement(**p, id=str(p["_id"])) for p in procurements]


@router.get("/vendor/{vendor_id}", response_model=list[Procurement])
async def get_vendor_procurements(
    vendor_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get all procurement orders for a vendor"""
    procurements = await get_procurements_by_vendor(db, vendor_id)
    return [Procurement(**p, id=str(p["_id"])) for p in procurements]


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
    return Procurement(**result, id=str(result["_id"]))


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
