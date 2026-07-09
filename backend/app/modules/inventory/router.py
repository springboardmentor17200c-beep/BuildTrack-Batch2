from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import get_current_user
from app.db.mongodb import get_database
from app.modules.inventory.db import (
    create_inventory_item,
    delete_inventory_item,
    get_inventory_item,
    get_low_stock_items,
    get_item_transactions,
    list_inventory,
    record_transaction,
    update_inventory_item,
)
from app.modules.inventory.models import (
    InventoryItem,
    InventoryItemCreate,
    InventoryItemUpdate,
    InventoryTransaction,
)

router = APIRouter()


@router.post("/", response_model=InventoryItem)
async def create_item_endpoint(
    item: InventoryItemCreate,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Create new inventory item"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin or manager can create inventory items",
        )

    item_data = item.model_dump()
    result = await create_inventory_item(db, item_data)
    return InventoryItem(**result, id=str(result["_id"]))


@router.get("/", response_model=list[InventoryItem])
async def list_inventory_endpoint(
    skip: int = 0,
    limit: int = 10,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """List all inventory items"""
    items = await list_inventory(db, skip, limit)
    return [InventoryItem(**i, id=str(i["_id"])) for i in items]


@router.get("/{item_id}", response_model=InventoryItem)
async def get_item_endpoint(
    item_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get inventory item by ID"""
    item = await get_inventory_item(db, item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory item not found",
        )
    return InventoryItem(**item, id=str(item["_id"]))


@router.get("/low-stock", response_model=list[InventoryItem])
async def get_low_stock_endpoint(
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get items below reorder level"""
    items = await get_low_stock_items(db)
    return [InventoryItem(**i, id=str(i["_id"])) for i in items]


@router.put("/{item_id}", response_model=InventoryItem)
async def update_item_endpoint(
    item_id: str,
    update: InventoryItemUpdate,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Update inventory item"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin or manager can update inventory items",
        )

    item = await get_inventory_item(db, item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory item not found",
        )

    update_data = update.model_dump(exclude_unset=True)
    result = await update_inventory_item(db, item_id, update_data)
    return InventoryItem(**result, id=str(result["_id"]))


@router.delete("/{item_id}")
async def delete_item_endpoint(
    item_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Delete inventory item"""
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin can delete inventory items",
        )

    deleted = await delete_inventory_item(db, item_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory item not found",
        )
    return {"message": "Inventory item deleted successfully"}


@router.post("/{item_id}/transactions", response_model=InventoryTransaction)
async def record_transaction_endpoint(
    item_id: str,
    transaction: InventoryTransaction,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Record inventory transaction"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin or manager can record transactions",
        )

    item = await get_inventory_item(db, item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory item not found",
        )

    transaction_data = transaction.model_dump()
    transaction_data["item_id"] = item_id
    result = await record_transaction(db, transaction_data)
    return result


@router.get("/{item_id}/transactions", response_model=list[InventoryTransaction])
async def get_item_transactions_endpoint(
    item_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get transaction history for item"""
    transactions = await get_item_transactions(db, item_id)
    return transactions
