from datetime import datetime

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase


async def create_inventory_item(db: AsyncIOMotorDatabase, item_data: dict):
    item_data["created_at"] = datetime.utcnow()
    item_data["updated_at"] = datetime.utcnow()
    
    result = await db.inventory.insert_one(item_data)
    return await db.inventory.find_one({"_id": result.inserted_id})


async def get_inventory_item(db: AsyncIOMotorDatabase, item_id: str):
    return await db.inventory.find_one({"_id": ObjectId(item_id)})


async def update_inventory_item(db: AsyncIOMotorDatabase, item_id: str, update_data: dict):
    update_data["updated_at"] = datetime.utcnow()
    await db.inventory.update_one(
        {"_id": ObjectId(item_id)},
        {"$set": update_data}
    )
    return await db.inventory.find_one({"_id": ObjectId(item_id)})


async def delete_inventory_item(db: AsyncIOMotorDatabase, item_id: str):
    result = await db.inventory.delete_one({"_id": ObjectId(item_id)})
    return result.deleted_count > 0


async def list_inventory(db: AsyncIOMotorDatabase, skip: int = 0, limit: int = 10):
    return await db.inventory.find().skip(skip).limit(limit).to_list(limit)


async def get_low_stock_items(db: AsyncIOMotorDatabase):
    return await db.inventory.find({
        "$expr": {"$lte": ["$quantity", "$reorder_level"]}
    }).to_list(None)


async def record_transaction(db: AsyncIOMotorDatabase, transaction_data: dict):
    transaction_data["created_at"] = datetime.utcnow()
    result = await db.inventory_transactions.insert_one(transaction_data)
    
    # Update inventory quantity
    item = await db.inventory.find_one({"_id": ObjectId(transaction_data["item_id"])})
    if item:
        if transaction_data["transaction_type"] == "in":
            new_quantity = item["quantity"] + transaction_data["quantity"]
        else:  # out or adjustment
            new_quantity = item["quantity"] - transaction_data["quantity"]
        
        # Update status based on quantity
        if new_quantity == 0:
            status = "out_of_stock"
        elif new_quantity <= item.get("reorder_level", 10):
            status = "low_stock"
        else:
            status = "in_stock"
        
        await db.inventory.update_one(
            {"_id": ObjectId(transaction_data["item_id"])},
            {"$set": {"quantity": new_quantity, "status": status}}
        )
    
    return await db.inventory_transactions.find_one({"_id": result.inserted_id})


async def get_item_transactions(db: AsyncIOMotorDatabase, item_id: str):
    return await db.inventory_transactions.find({"item_id": item_id}).to_list(None)
