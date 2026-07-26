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
    InventoryTransactionCreate,
)

router = APIRouter()


def serialize_doc(doc: dict) -> dict:
    """Convert MongoDB ObjectId to string."""
    doc = dict(doc)
    if "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc


# -----------------------------
# Inventory Item Endpoints
# -----------------------------

@router.post("/", response_model=InventoryItem)
async def create_item_endpoint(
    item: InventoryItemCreate,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin or manager can create inventory items",
        )

    result = await create_inventory_item(db, item.model_dump())
    return InventoryItem(**serialize_doc(result))


@router.get("/", response_model=list[InventoryItem])
async def list_inventory_endpoint(
    skip: int = 0,
    limit: int = 10,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    items = await list_inventory(db, skip, limit)
    return [InventoryItem(**serialize_doc(i)) for i in items]


# IMPORTANT: keep this BEFORE /{item_id}
@router.get("/low-stock", response_model=list[InventoryItem])
async def get_low_stock_endpoint(
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    items = await get_low_stock_items(db)
    return [InventoryItem(**serialize_doc(i)) for i in items]


@router.get("/{item_id}", response_model=InventoryItem)
async def get_item_endpoint(
    item_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    item = await get_inventory_item(db, item_id)

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory item not found",
        )

    return InventoryItem(**serialize_doc(item))


@router.put("/{item_id}", response_model=InventoryItem)
async def update_item_endpoint(
    item_id: str,
    update: InventoryItemUpdate,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
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

    result = await update_inventory_item(
        db,
        item_id,
        update.model_dump(exclude_unset=True),
    )

    return InventoryItem(**serialize_doc(result))


@router.delete("/{item_id}")
async def delete_item_endpoint(
    item_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
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


# -----------------------------
# Inventory Transaction Endpoints
# -----------------------------

@router.post("/{item_id}/transactions", response_model=InventoryTransaction)
async def record_transaction_endpoint(
    item_id: str,
    transaction: InventoryTransactionCreate,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
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

    return InventoryTransaction(**serialize_doc(result))


@router.get("/{item_id}/transactions", response_model=list[InventoryTransaction])
async def get_item_transactions_endpoint(
    item_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    transactions = await get_item_transactions(db, item_id)

    return [
        InventoryTransaction(**serialize_doc(t))
        for t in transactions
    ]