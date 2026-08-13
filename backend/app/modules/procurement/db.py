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
    # Validate project reference (save its actual database ID, not just the name).
    project_id = data.get("project_id")
    if project_id:
        project = await db.projects.find_one({"_id": oid(project_id)}) if oid(project_id) else None
        if not project:
            return None, "Invalid project selected"
        data["project"] = project.get("name") or data.get("project", "Project")
        data["project_id"] = str(project["_id"])

    # Validate material reference against the inventory/material master collection.
    material_id = data.get("material_id")
    material = None
    if material_id:
        material = await db.inventory.find_one({"_id": oid(material_id)}) if oid(material_id) else None
        if not material:
            return None, "Invalid material selected"
        data["material_name"] = material.get("material_name") or material.get("material") or data.get("material_name", "Material")
        data["material_id"] = str(material["_id"])
        data.setdefault("unit", material.get("unit"))

    data["request_id"] = await next_code(db, "material_requests", "MR")
    data["status"] = "pending"
    data["requested_by"] = user.get("full_name") or str(user.get("_id", ""))
    return await create_doc(db, "material_requests", data, user), None


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


async def assign_vendor_to_material_request(db: AsyncIOMotorDatabase, request_id: str, vendor_id: str, user: dict):
    request = await get_doc(db, "material_requests", request_id)
    if not request:
        return None, "Material request not found"
    if request.get("status") == "rejected":
        return None, "Cannot assign vendor to a rejected request"
    if request.get("status") not in {"approved", "vendor_assigned", "sent_to_vendor"}:
        return None, "Vendor can be assigned only after request approval"

    vendor = await get_doc(db, "vendors", vendor_id)
    if not vendor:
        return None, "Vendor not found"
    if vendor.get("status") != "active":
        return None, "Only active vendors can be assigned"

    data = {
        "vendor_id": vendor_id,
        "vendor_name": vendor.get("vendor_name"),
        "vendor_assigned_by": user.get("full_name") or str(user.get("_id", "")),
        "vendor_assigned_at": now(),
        "assigned_vendor_id": vendor_id,
        "vendor_response": None,
        "vendor_response_date": None,
        "vendor_comment": None,
        "status": "sent_to_vendor",
        "updated_at": now(),
    }
    await db.material_requests.update_one({"_id": request["_id"]}, {"$set": data})
    await log_activity(db, "vendor_assigned", "material_requests", request_id, user, {"vendor_id": vendor_id})
    return await db.material_requests.find_one({"_id": request["_id"]}), None


async def vendor_respond_to_request(db: AsyncIOMotorDatabase, request_id: str, action: str, comment: str | None, user: dict):
    """Vendor accepts/rejects a procurement request assigned to their vendor record."""
    request = await get_doc(db, "material_requests", request_id)
    if not request:
        return None, "Material request not found"

    # 1. Only a vendor user may respond.
    if user.get("role") != "vendor":
        return None, "Only a vendor user can respond to procurement requests"

    # 2. The vendor must be linked to a vendor record.
    vendor_id = user.get("vendor_id")
    if not vendor_id:
        return None, "Your account is not linked to a vendor record"

    # 3. This vendor must be the one assigned to this request.
    if str(request.get("vendor_id") or request.get("assigned_vendor_id") or "") != str(vendor_id):
        return None, "You are not the assigned vendor for this request"

    # 4. Request must be in a valid state for acceptance/rejection.
    if request.get("status") not in {"sent_to_vendor", "vendor_assigned", "vendor_accepted", "vendor_rejected"}:
        return None, "This request is not available for vendor response"

    # 5. Request cannot be responded to twice.
    if request.get("vendor_response") is not None:
        return None, "You have already responded to this request"

    # 6. Rejection requires a reason/comment.
    if action == "reject" and not (comment and comment.strip()):
        return None, "A rejection reason or comment is required"

    new_status = "vendor_accepted" if action == "accept" else "vendor_rejected"
    data = {
        "status": new_status,
        "vendor_response": action,
        "vendor_response_date": now(),
        "vendor_comment": comment,
        "updated_at": now(),
    }
    await db.material_requests.update_one({"_id": request["_id"]}, {"$set": data})
    await log_activity(db, f"vendor_{action}", "material_requests", request_id, user, {"comment": comment})
    return await db.material_requests.find_one({"_id": request["_id"]}), None

async def create_purchase_order_from_request(db: AsyncIOMotorDatabase, data: dict, user: dict):
    request = await get_doc(db, "material_requests", data["request_id"])
    if not request:
        return None, "Material request not found"
    if request.get("purchase_order_id"):
        return None, "Purchase order already exists for this material request"

    assigned_vendor_id = request.get("vendor_id") or data.get("vendor_id")
    if not assigned_vendor_id:
        return None, "Assign a vendor before generating a purchase order"

    if request.get("status") != "vendor_accepted":
        return None, "Purchase order can be generated only after the vendor accepts the procurement request"

    vendor = await get_doc(db, "vendors", assigned_vendor_id)
    if not vendor:
        return None, "Assigned vendor not found"
    if vendor.get("status") != "active":
        return None, "Assigned vendor is not active"

    if request.get("vendor_id") and data.get("vendor_id") and data["vendor_id"] != request["vendor_id"]:
        return None, "Purchase order vendor must match the assigned request vendor"

    data["vendor_id"] = assigned_vendor_id
    data["project"] = request["project"]
    data["project_id"] = request.get("project_id")
    data["materials"] = request["material_name"]
    data["material_id"] = request.get("material_id")
    data["quantity"] = request["quantity"]
    data["po_number"] = await next_code(db, "purchase_orders", "PO")
    subtotal = float(data["quantity"]) * float(data.get("unit_price") or 0)
    gst = float(data.get("gst") or 0)
    data["subtotal"] = subtotal
    data["gst"] = gst
    data["total_cost"] = subtotal + gst
    doc = await create_doc(db, "purchase_orders", data, user)
    await db.material_requests.update_one(
        {"_id": request["_id"]},
        {
            "$set": {
                "status": "po_generated",
                "vendor_id": assigned_vendor_id,
                "vendor_name": vendor.get("vendor_name"),
                "vendor_assigned_by": request.get("vendor_assigned_by") or user.get("full_name") or str(user.get("_id", "")),
                "vendor_assigned_at": request.get("vendor_assigned_at") or now(),
                "purchase_order_id": str(doc["_id"]),
                "po_number": doc["po_number"],
                "updated_at": now(),
            }
        },
    )
    await log_activity(db, "po_generated", "material_requests", data["request_id"], user, {"purchase_order_id": str(doc["_id"])})
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
    # Resolve material name/id from the linked purchase order when available.
    po = await get_doc(db, "purchase_orders", data.get("purchase_order_id", "")) if data.get("purchase_order_id") else None
    if po:
        data.setdefault("material", po.get("materials") or data.get("material", ""))
        data.setdefault("material_id", po.get("material_id"))
        data.setdefault("vendor_id", po.get("vendor_id"))

    delivery_date = data.get("delivery_date") or now()
    # Deterministic key so the exact same delivery can never update stock twice.
    reference = ":".join(
        str(data.get("purchase_order_id", "")),
        str(data.get("material", "")),
        str(data.get("quantity_received", "")),
        str(delivery_date),
    )
    already_processed = await db.inventory_transactions.find_one(
        {"reference": reference, "transaction_type": "PURCHASE_RECEIPT"}
    ) is not None

    # Partial delivery: if received < ordered quantity mark as partial.
    ordered_qty = float(po.get("quantity") or 0) if po else float(data.get("quantity_ordered") or 0)
    received = float(data["quantity_received"])
    partial = po is not None and ordered_qty > received
    if partial:
        data["status"] = "partial"
    elif data.get("status") not in {"accepted", "rejected"}:
        data["status"] = "accepted" if data.get("quality_status") == "passed" else "rejected"

    doc = await create_doc(db, "deliveries", data, user)

    # Only a Store Manager verified & accepted delivery (quality passed) increases stock.
    if (
        not already_processed
        and data.get("status") in {"accepted", "partial"}
        and data.get("quality_status") == "passed"
        and received > 0
    ):
        transaction = {
            "transaction_type": "PURCHASE_RECEIPT",
            "reference": reference,
            "material_id": data.get("material_id"),
            "project_id": po.get("project_id") if po else data.get("project_id"),
            "purchase_order_id": data.get("purchase_order_id"),
            "delivery_id": str(doc["_id"]),
            "quantity": received,
            "unit": data.get("unit") or (po.get("unit") if po else None),
            "created_by": user.get("full_name") or str(user.get("_id", "")),
            "created_at": now(),
        }
        await db.inventory_transactions.insert_one(transaction)

        existing = await db.inventory.find_one(
            {"$or": [{"material": data["material"]}, {"material_name": data["material"]}]}
        )
        inventory_payload = {
            "material": data["material"],
            "material_name": data["material"],
            "stock_quantity": received,
            "quantity": received,
            "unit": transaction.get("unit") or "Nos",
            "updated_at": now(),
        }
        if existing:
            await db.inventory.update_one(
                {"_id": existing["_id"]},
                {
                    "$inc": {"stock_quantity": received, "quantity": received},
                    "$push": {"transactions": transaction},
                    "$set": {
                        "material": data["material"],
                        "material_name": data["material"],
                        "material_id": data.get("material_id") or existing.get("material_id"),
                        "updated_at": now(),
                    },
                },
            )
        else:
            await db.inventory.insert_one(
                {
                    **inventory_payload,
                    "status": "in_stock",
                    "reorder_level": 10,
                    "transactions": [transaction],
                    "created_at": now(),
                }
            )
        await log_activity(db, "inventory_increased", "inventory", data["material"], user, transaction)

    # Sync downstream PO / request statuses based on this delivery.
    delivery_status = data.get("status")
    if po:
        po_updates = {"updated_at": now()}
        if delivery_status == "accepted":
            po_updates["status"] = "delivered"
        elif delivery_status == "partial":
            po_updates["status"] = "accepted"
        elif delivery_status == "rejected":
            po_updates["status"] = "sent"
        await db.purchase_orders.update_one({"_id": po["_id"]}, {"$set": po_updates})

        req = await db.material_requests.find_one({"purchase_order_id": str(po["_id"])})
        if req:
            req_status = (
                "partially_delivered" if delivery_status == "partial"
                else "delivered" if delivery_status == "accepted"
                else req.get("status")
            )
            if req_status != req.get("status"):
                await db.material_requests.update_one(
                    {"_id": req["_id"]}, {"$set": {"status": req_status, "updated_at": now()}}
                )

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

async def list_materials_from_inventory(db: AsyncIOMotorDatabase, active_only: bool = True):
    """Material master list sourced from the `inventory` collection."""
    query = {}
    if active_only:
        query["$or"] = [
            {"status": {"$nin": ["inactive", "deleted"]}},
            {"status": {"$exists": False}},
        ]
    docs = await db.inventory.find(query).sort("material_name", 1).to_list(200)
    return docs


async def get_inventory_history(db: AsyncIOMotorDatabase, material_id: str | None = None, limit: int = 100):
    """Inventory transaction history (opening stock + entries)."""
    query = {}
    if material_id:
        query["material_id"] = material_id
    txn_cursor = db.inventory_transactions.find(query).sort("created_at", -1).limit(limit)
    transactions = await txn_cursor.to_list(limit)

    # Crawl back through receipts to compute opening stock for a material.
    opening = {}
    material_names = {}
    inventory_items = await db.inventory.find().to_list(200)
    for item in inventory_items:
        mid = str(item.get("_id"))
        material_names[mid] = item.get("material_name") or item.get("material") or item.get("material", "")
        stock = float(item.get("stock_quantity") or item.get("quantity") or 0)
        opening[mid] = stock - sum(
            float(t.get("quantity") or 0)
            for t in await db.inventory_transactions.find({"material_id": mid}).to_list(1000)
        )
    return {"materials": material_names, "opening_stock": opening, "transactions": transactions}


async def vendor_dashboard_stats(db: AsyncIOMotorDatabase, vendor_id: str):
    """Summary + records for the logged-in vendor's portal."""
    assigned_states = ["sent_to_vendor", "vendor_assigned", "vendor_accepted"]
    requests = await db.material_requests.find(
        {"$or": [{"vendor_id": vendor_id}, {"assigned_vendor_id": vendor_id}]}
    ).sort("created_at", -1).to_list(200)

    po_ids = [r.get("purchase_order_id") for r in requests if r.get("purchase_order_id")]
    pos = []
    if po_ids:
        from bson import ObjectId as _Oid
        pos = await db.purchase_orders.find({"_id": {"$in": [_Oid(pid) for pid in po_ids if _Oid.is_valid(pid)]}}).to_list(200)

    pending_responses = sum(1 for r in requests if r.get("status") == "sent_to_vendor")
    accepted = sum(1 for r in requests if r.get("status") == "vendor_accepted")
    total_po_ids = [p.get("_id") for p in pos]
    pending_deliveries = 0
    if total_po_ids:
        pending_deliveries = await db.deliveries.count_documents(
            {"purchase_order_id": {"$in": [str(i) for i in total_po_ids]}, "status": {"$in": ["pending", "partial"]}}
        )
    pending_payments = await db.invoices.count_documents(
        {"vendor_id": vendor_id, "payment_status": {"$in": ["pending", "approved"]}}
    )
    vendor = await get_doc(db, "vendors", vendor_id)
    return {
        "vendor": vendor,
        "total_assigned": len(requests),
        "pending_responses": pending_responses,
        "accepted_requests": accepted,
        "rejected_requests": sum(1 for r in requests if r.get("status") == "vendor_rejected"),
        "total_purchase_orders": len(pos),
        "pending_deliveries": pending_deliveries,
        "pending_payments": pending_payments,
        "requests": requests,
        "purchase_orders": pos,
    }
