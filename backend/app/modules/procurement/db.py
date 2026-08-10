from datetime import datetime
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from motor.motor_asyncio import AsyncIOMotorDatabase


def oid(value: str) -> ObjectId | None:
    try:
        return ObjectId(value)
    except InvalidId:
        return None


def now() -> datetime:
    return datetime.utcnow()


async def next_code(db: AsyncIOMotorDatabase, name: str, prefix: str) -> str:
    counter = await db.counters.find_one_and_update(
        {"_id": name},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    return f"{prefix}-{counter['seq']:05d}"


async def log_activity(db: AsyncIOMotorDatabase, action: str, entity: str, entity_id: str, user: dict | None = None, meta: dict | None = None):
    await db.procurement_activity.insert_one(
        {
            "action": action,
            "entity": entity,
            "entity_id": entity_id,
            "user_id": str(user.get("_id", "")) if user else None,
            "user_name": user.get("full_name") if user else None,
            "meta": meta or {},
            "created_at": now(),
        }
    )


async def create_doc(db: AsyncIOMotorDatabase, collection: str, data: dict, user: dict | None = None):
    data["created_at"] = now()
    data["updated_at"] = now()
    result = await db[collection].insert_one(data)
    doc = await db[collection].find_one({"_id": result.inserted_id})
    await log_activity(db, "created", collection, str(result.inserted_id), user)
    return doc


async def get_doc(db: AsyncIOMotorDatabase, collection: str, doc_id: str):
    object_id = oid(doc_id)
    if not object_id:
        return None
    return await db[collection].find_one({"_id": object_id})


async def update_doc(db: AsyncIOMotorDatabase, collection: str, doc_id: str, data: dict, user: dict | None = None):
    object_id = oid(doc_id)
    if not object_id:
        return None
    data["updated_at"] = now()
    await db[collection].update_one({"_id": object_id}, {"$set": data})
    await log_activity(db, "updated", collection, doc_id, user, data)
    return await db[collection].find_one({"_id": object_id})


async def delete_doc(db: AsyncIOMotorDatabase, collection: str, doc_id: str, user: dict | None = None) -> bool:
    object_id = oid(doc_id)
    if not object_id:
        return False
    result = await db[collection].delete_one({"_id": object_id})
    if result.deleted_count:
        await log_activity(db, "deleted", collection, doc_id, user)
    return result.deleted_count > 0


async def list_docs(
    db: AsyncIOMotorDatabase,
    collection: str,
    skip: int = 0,
    limit: int = 20,
    search: str | None = None,
    fields: list[str] | None = None,
    filters: dict[str, Any] | None = None,
    sort_by: str = "created_at",
    sort_dir: int = -1,
):
    query: dict[str, Any] = filters.copy() if filters else {}
    if search and fields:
        query["$or"] = [{field: {"$regex": search, "$options": "i"}} for field in fields]
    cursor = db[collection].find(query).sort(sort_by, sort_dir).skip(skip).limit(limit)
    total = await db[collection].count_documents(query)
    return {"items": await cursor.to_list(limit), "total": total}


async def create_material_request(db: AsyncIOMotorDatabase, data: dict, user: dict):
    data["request_id"] = await next_code(db, "material_requests", "MR")
    data["status"] = "pending"
    data["requested_by"] = user.get("full_name") or str(user.get("_id", ""))
    return await create_doc(db, "material_requests", data, user)


async def approve_material_request(db: AsyncIOMotorDatabase, request_id: str, status: str, comments: str | None, user: dict):
    object_id = oid(request_id)
    if not object_id:
        return None
    data = {
        "status": status,
        "approval_comments": comments,
        "approved_by": user.get("full_name") or str(user.get("_id", "")),
        "approved_at": now(),
        "updated_at": now(),
    }
    await db.material_requests.update_one({"_id": object_id}, {"$set": data})
    await log_activity(db, status, "material_requests", request_id, user, {"comments": comments})
    return await db.material_requests.find_one({"_id": object_id})


async def create_purchase_order_from_request(db: AsyncIOMotorDatabase, data: dict, user: dict):
    request = await get_doc(db, "material_requests", data["request_id"])
    if not request or request.get("status") != "approved":
        return None, "Purchase order can be generated only for approved requests"
    data["po_number"] = await next_code(db, "purchase_orders", "PO")
    data["total_cost"] = float(data["quantity"]) * float(data["unit_price"])
    doc = await create_doc(db, "purchase_orders", data, user)
    return doc, None


async def update_purchase_order(db: AsyncIOMotorDatabase, po_id: str, data: dict, user: dict):
    if "quantity" in data or "unit_price" in data:
        current = await get_doc(db, "purchase_orders", po_id)
        if not current:
            return None
        quantity = float(data.get("quantity", current.get("quantity", 0)))
        unit_price = float(data.get("unit_price", current.get("unit_price", 0)))
        data["total_cost"] = quantity * unit_price
    return await update_doc(db, "purchase_orders", po_id, data, user)


async def create_delivery_and_inventory(db: AsyncIOMotorDatabase, data: dict, user: dict):
    doc = await create_doc(db, "deliveries", data, user)
    if data.get("status") in {"accepted", "partial"} and data.get("quality_status") == "passed":
        transaction = {
            "type": "procurement_delivery",
            "quantity": data["quantity_received"],
            "delivery_id": str(doc["_id"]),
            "purchase_order_id": data["purchase_order_id"],
            "created_at": now(),
            "created_by": user.get("full_name"),
        }
        await db.inventory.update_one(
            {"material": data["material"]},
            {
                "$inc": {"stock_quantity": data["quantity_received"]},
                "$push": {"transactions": transaction},
                "$set": {"updated_at": now()},
                "$setOnInsert": {"created_at": now()},
            },
            upsert=True,
        )
        await log_activity(db, "inventory_increased", "inventory", data["material"], user, transaction)
    return doc


async def update_invoice_status(db: AsyncIOMotorDatabase, invoice_id: str, status: str, user: dict, comments: str | None = None):
    data = {"status": status, "verification_comments": comments}
    if status == "approved":
        data["payment_status"] = "approved"
    if status == "rejected":
        data["payment_status"] = "pending"
    return await update_doc(db, "invoices", invoice_id, data, user)


async def create_payment_for_invoice(db: AsyncIOMotorDatabase, data: dict, user: dict):
    invoice = await get_doc(db, "invoices", data["invoice_id"])
    if not invoice:
        return None, "Invoice not found"
    if invoice.get("status") != "approved":
        return None, "Payment can be created only for approved invoices"
    return await create_doc(db, "payments", data, user), None


async def dashboard_stats(db: AsyncIOMotorDatabase):
    activity = await db.procurement_activity.find().sort("created_at", -1).limit(10).to_list(10)
    return {
        "pending_requests": await db.material_requests.count_documents({"status": "pending"}),
        "active_purchase_orders": await db.purchase_orders.count_documents({"status": {"$in": ["created", "sent", "accepted"]}}),
        "pending_deliveries": await db.deliveries.count_documents({"status": {"$in": ["pending", "partial"]}}),
        "pending_payments": await db.payments.count_documents({"status": {"$in": ["pending", "approved"]}}),
        "recent_activity": activity,
    }


async def create_vendor(db: AsyncIOMotorDatabase, data: dict):
    return await create_doc(db, "vendors", data)


async def get_vendor(db: AsyncIOMotorDatabase, vendor_id: str):
    return await get_doc(db, "vendors", vendor_id)


async def list_vendors(db: AsyncIOMotorDatabase, skip: int = 0, limit: int = 10):
    res = await list_docs(db, "vendors", skip=skip, limit=limit)
    return res["items"]


async def create_procurement(db: AsyncIOMotorDatabase, data: dict):
    return await create_doc(db, "procurements", data)


async def get_procurement(db: AsyncIOMotorDatabase, procurement_id: str):
    return await get_doc(db, "procurements", procurement_id)


async def list_procurements(db: AsyncIOMotorDatabase, skip: int = 0, limit: int = 10):
    res = await list_docs(db, "procurements", skip=skip, limit=limit)
    return res["items"]


async def update_procurement(db: AsyncIOMotorDatabase, procurement_id: str, data: dict):
    return await update_doc(db, "procurements", procurement_id, data)


async def delete_procurement(db: AsyncIOMotorDatabase, procurement_id: str):
    return await delete_doc(db, "procurements", procurement_id)


async def list_purchase_orders(db: AsyncIOMotorDatabase, skip: int = 0, limit: int = 10):
    res = await list_docs(db, "purchase_orders", skip=skip, limit=limit)
    return res["items"]


async def list_invoices(db: AsyncIOMotorDatabase, skip: int = 0, limit: int = 10):
    res = await list_docs(db, "invoices", skip=skip, limit=limit)
    return res["items"]

