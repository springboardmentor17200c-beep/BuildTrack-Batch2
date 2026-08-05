from datetime import datetime

from bson import ObjectId
from bson.errors import InvalidId
from motor.motor_asyncio import AsyncIOMotorDatabase


# ===========================
# Vendor CRUD Operations
# ===========================

async def create_vendor(db: AsyncIOMotorDatabase, vendor_data: dict):
    vendor_data["created_at"] = datetime.utcnow()

    result = await db.vendors.insert_one(vendor_data)
    return await db.vendors.find_one({"_id": result.inserted_id})


async def get_vendor(db: AsyncIOMotorDatabase, vendor_id: str):
    try:
        oid = ObjectId(vendor_id)
    except InvalidId:
        return None

    return await db.vendors.find_one({"_id": oid})


async def update_vendor(db: AsyncIOMotorDatabase, vendor_id: str, update_data: dict):
    try:
        oid = ObjectId(vendor_id)
    except InvalidId:
        return None

    await db.vendors.update_one(
        {"_id": oid},
        {"$set": update_data}
    )

    return await db.vendors.find_one({"_id": oid})


async def delete_vendor(db: AsyncIOMotorDatabase, vendor_id: str):
    try:
        oid = ObjectId(vendor_id)
    except InvalidId:
        return False

    result = await db.vendors.delete_one({"_id": oid})
    return result.deleted_count > 0


async def list_vendors(
    db: AsyncIOMotorDatabase,
    skip: int = 0,
    limit: int = 10,
):
    return await db.vendors.find().skip(skip).limit(limit).to_list(limit)

async def delete_vendor(
    db: AsyncIOMotorDatabase,
    vendor_id: str,
):
    try:
        oid = ObjectId(vendor_id)
    except InvalidId:
        return False

    result = await db.vendors.delete_one({"_id": oid})
    return result.deleted_count > 0


async def search_vendors(
    db: AsyncIOMotorDatabase,
    keyword: str,
):
    return await db.vendors.find(
        {
            "$or": [
                {
                    "vendor_name": {
                        "$regex": keyword,
                        "$options": "i",
                    }
                },
                {
                    "contact_person": {
                        "$regex": keyword,
                        "$options": "i",
                    }
                },
                {
                    "email": {
                        "$regex": keyword,
                        "$options": "i",
                    }
                },
            ]
        }
    ).to_list(None)


async def get_vendors_by_rating(
    db: AsyncIOMotorDatabase,
    rating: float,
):
    return await db.vendors.find(
        {
            "rating": {
                "$gte": rating
            }
        }
    ).to_list(None)


# ===========================
# Procurement CRUD Operations
# ===========================

async def create_procurement(db: AsyncIOMotorDatabase, procurement_data: dict):
    procurement_data["created_at"] = datetime.utcnow()
    procurement_data["updated_at"] = datetime.utcnow()

    result = await db.procurements.insert_one(procurement_data)
    return await db.procurements.find_one({"_id": result.inserted_id})


async def get_procurement(db: AsyncIOMotorDatabase, procurement_id: str):
    try:
        oid = ObjectId(procurement_id)
    except InvalidId:
        return None

    return await db.procurements.find_one({"_id": oid})


async def update_procurement(
    db: AsyncIOMotorDatabase,
    procurement_id: str,
    update_data: dict,
):
    try:
        oid = ObjectId(procurement_id)
    except InvalidId:
        return None

    update_data["updated_at"] = datetime.utcnow()

    await db.procurements.update_one(
        {"_id": oid},
        {"$set": update_data},
    )

    return await db.procurements.find_one({"_id": oid})


async def delete_procurement(db: AsyncIOMotorDatabase, procurement_id: str):
    try:
        oid = ObjectId(procurement_id)
    except InvalidId:
        return False

    result = await db.procurements.delete_one({"_id": oid})
    return result.deleted_count > 0


async def list_procurements(
    db: AsyncIOMotorDatabase,
    skip: int = 0,
    limit: int = 10,
):
    return await db.procurements.find().skip(skip).limit(limit).to_list(limit)


async def get_procurement_by_status(
    db: AsyncIOMotorDatabase,
    status: str,
):
    return await db.procurements.find(
        {"status": status}
    ).to_list(None)


async def get_procurements_by_project(
    db: AsyncIOMotorDatabase,
    project_id: str,
):
    return await db.procurements.find(
        {"project_id": project_id}
    ).to_list(None)


async def get_procurements_by_vendor(
    db: AsyncIOMotorDatabase,
    vendor_id: str,
):
    return await db.procurements.find(
        {"vendor_id": vendor_id}
    ).to_list(None)


# ===========================
# Purchase Order CRUD
# ===========================

async def create_purchase_order(db: AsyncIOMotorDatabase, purchase_order_data: dict):
    purchase_order_data["created_at"] = datetime.utcnow()
    purchase_order_data["updated_at"] = datetime.utcnow()

    result = await db.purchase_orders.insert_one(purchase_order_data)
    return await db.purchase_orders.find_one({"_id": result.inserted_id})


async def get_purchase_order(db: AsyncIOMotorDatabase, po_id: str):
    try:
        oid = ObjectId(po_id)
    except InvalidId:
        return None

    return await db.purchase_orders.find_one({"_id": oid})


async def list_purchase_orders(db: AsyncIOMotorDatabase, skip: int = 0, limit: int = 10):
    return await db.purchase_orders.find().sort("created_at", -1).skip(skip).limit(limit).to_list(limit)


async def update_purchase_order(db: AsyncIOMotorDatabase, po_id: str, update_data: dict):
    try:
        oid = ObjectId(po_id)
    except InvalidId:
        return None

    update_data["updated_at"] = datetime.utcnow()
    await db.purchase_orders.update_one({"_id": oid}, {"$set": update_data})
    return await db.purchase_orders.find_one({"_id": oid})


async def delete_purchase_order(db: AsyncIOMotorDatabase, po_id: str):
    try:
        oid = ObjectId(po_id)
    except InvalidId:
        return False

    result = await db.purchase_orders.delete_one({"_id": oid})
    return result.deleted_count > 0


# ===========================
# Invoice Tracking CRUD
# ===========================

async def create_invoice(db: AsyncIOMotorDatabase, invoice_data: dict):
    invoice_data["created_at"] = datetime.utcnow()
    invoice_data["updated_at"] = datetime.utcnow()

    result = await db.invoices.insert_one(invoice_data)
    return await db.invoices.find_one({"_id": result.inserted_id})


async def get_invoice(db: AsyncIOMotorDatabase, invoice_id: str):
    try:
        oid = ObjectId(invoice_id)
    except InvalidId:
        return None

    return await db.invoices.find_one({"_id": oid})


async def list_invoices(db: AsyncIOMotorDatabase, skip: int = 0, limit: int = 10):
    return await db.invoices.find().sort("created_at", -1).skip(skip).limit(limit).to_list(limit)


async def update_invoice(db: AsyncIOMotorDatabase, invoice_id: str, update_data: dict):
    try:
        oid = ObjectId(invoice_id)
    except InvalidId:
        return None

    update_data["updated_at"] = datetime.utcnow()
    await db.invoices.update_one({"_id": oid}, {"$set": update_data})
    return await db.invoices.find_one({"_id": oid})


async def delete_invoice(db: AsyncIOMotorDatabase, invoice_id: str):
    try:
        oid = ObjectId(invoice_id)
    except InvalidId:
        return False

    result = await db.invoices.delete_one({"_id": oid})
    return result.deleted_count > 0