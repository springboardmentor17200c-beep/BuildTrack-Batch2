from datetime import datetime

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase


# Vendor CRUD operations
async def create_vendor(db: AsyncIOMotorDatabase, vendor_data: dict):
    vendor_data["created_at"] = datetime.utcnow()
    result = await db.vendors.insert_one(vendor_data)
    return await db.vendors.find_one({"_id": result.inserted_id})


async def get_vendor(db: AsyncIOMotorDatabase, vendor_id: str):
    return await db.vendors.find_one({"_id": ObjectId(vendor_id)})


async def update_vendor(db: AsyncIOMotorDatabase, vendor_id: str, update_data: dict):
    await db.vendors.update_one(
        {"_id": ObjectId(vendor_id)},
        {"$set": update_data}
    )
    return await db.vendors.find_one({"_id": ObjectId(vendor_id)})


async def list_vendors(db: AsyncIOMotorDatabase, skip: int = 0, limit: int = 10):
    return await db.vendors.find().skip(skip).limit(limit).to_list(limit)


# Procurement CRUD operations
async def create_procurement(db: AsyncIOMotorDatabase, procurement_data: dict):
    procurement_data["created_at"] = datetime.utcnow()
    procurement_data["updated_at"] = datetime.utcnow()
    
    result = await db.procurements.insert_one(procurement_data)
    return await db.procurements.find_one({"_id": result.inserted_id})


async def get_procurement(db: AsyncIOMotorDatabase, procurement_id: str):
    return await db.procurements.find_one({"_id": ObjectId(procurement_id)})


async def update_procurement(db: AsyncIOMotorDatabase, procurement_id: str, update_data: dict):
    update_data["updated_at"] = datetime.utcnow()
    await db.procurements.update_one(
        {"_id": ObjectId(procurement_id)},
        {"$set": update_data}
    )
    return await db.procurements.find_one({"_id": ObjectId(procurement_id)})


async def delete_procurement(db: AsyncIOMotorDatabase, procurement_id: str):
    result = await db.procurements.delete_one({"_id": ObjectId(procurement_id)})
    return result.deleted_count > 0


async def list_procurements(db: AsyncIOMotorDatabase, skip: int = 0, limit: int = 10):
    return await db.procurements.find().skip(skip).limit(limit).to_list(limit)


async def get_procurement_by_status(db: AsyncIOMotorDatabase, status: str):
    return await db.procurements.find({"status": status}).to_list(None)


async def get_procurements_by_project(db: AsyncIOMotorDatabase, project_id: str):
    return await db.procurements.find({"project_id": project_id}).to_list(None)


async def get_procurements_by_vendor(db: AsyncIOMotorDatabase, vendor_id: str):
    return await db.procurements.find({"vendor_id": vendor_id}).to_list(None)
