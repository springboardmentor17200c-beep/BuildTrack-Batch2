from datetime import datetime
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.security import get_current_user
from app.db.mongodb import get_database

router = APIRouter()


class FrontendRecord(BaseModel):
    data: dict[str, Any]


def serialize(value: Any) -> Any:
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, list):
        return [serialize(item) for item in value]
    if isinstance(value, dict):
        return {key: serialize(item) for key, item in value.items()}
    return value


async def list_collection(db, collection_name: str) -> list[dict[str, Any]]:
    docs = await db[collection_name].find().to_list(None)
    return [serialize(doc) for doc in docs]


async def create_record(db, collection_name: str, data: dict[str, Any]) -> dict[str, Any]:
    now = datetime.utcnow()
    record = {
        **data,
        "created_at": data.get("created_at", now),
        "updated_at": data.get("updated_at", now),
    }
    record.pop("id", None)
    record.pop("_id", None)
    result = await db[collection_name].insert_one(record)
    created = await db[collection_name].find_one({"_id": result.inserted_id})
    return serialize(created)


def id_filter(record_id: str) -> dict[str, Any]:
    try:
        return {"_id": ObjectId(record_id)}
    except InvalidId:
        return {"id": record_id}


async def update_record(db, collection_name: str, record_id: str, data: dict[str, Any]) -> dict[str, Any]:
    update_data = {**data, "updated_at": datetime.utcnow()}
    update_data.pop("_id", None)
    update_data.pop("id", None)
    query = id_filter(record_id)
    await db[collection_name].update_one(query, {"$set": update_data})
    updated = await db[collection_name].find_one(query)
    return serialize(updated)


async def delete_record(db, collection_name: str, record_id: str) -> dict[str, str]:
    await db[collection_name].delete_one(id_filter(record_id))
    return {"message": "Deleted"}


@router.get("/projects")
async def projects(current_user=Depends(get_current_user), db=Depends(get_database)):
    return await list_collection(db, "projects")


@router.post("/projects")
async def create_project(record: FrontendRecord, current_user=Depends(get_current_user), db=Depends(get_database)):
    return await create_record(db, "projects", record.data)


@router.put("/projects/{record_id}")
async def update_project(record_id: str, record: FrontendRecord, current_user=Depends(get_current_user), db=Depends(get_database)):
    return await update_record(db, "projects", record_id, record.data)


@router.delete("/projects/{record_id}")
async def delete_project(record_id: str, current_user=Depends(get_current_user), db=Depends(get_database)):
    return await delete_record(db, "projects", record_id)


@router.get("/inventory")
async def inventory(current_user=Depends(get_current_user), db=Depends(get_database)):
    return await list_collection(db, "inventory")


@router.post("/inventory")
async def create_inventory(record: FrontendRecord, current_user=Depends(get_current_user), db=Depends(get_database)):
    return await create_record(db, "inventory", record.data)


@router.put("/inventory/{record_id}")
async def update_inventory(record_id: str, record: FrontendRecord, current_user=Depends(get_current_user), db=Depends(get_database)):
    return await update_record(db, "inventory", record_id, record.data)


@router.delete("/inventory/{record_id}")
async def delete_inventory(record_id: str, current_user=Depends(get_current_user), db=Depends(get_database)):
    return await delete_record(db, "inventory", record_id)


@router.get("/workers")
async def workers(current_user=Depends(get_current_user), db=Depends(get_database)):
    return await list_collection(db, "workers")


@router.post("/workers")
async def create_worker(record: FrontendRecord, current_user=Depends(get_current_user), db=Depends(get_database)):
    return await create_record(db, "workers", record.data)


@router.put("/workers/{record_id}")
async def update_worker(record_id: str, record: FrontendRecord, current_user=Depends(get_current_user), db=Depends(get_database)):
    return await update_record(db, "workers", record_id, record.data)


@router.delete("/workers/{record_id}")
async def delete_worker(record_id: str, current_user=Depends(get_current_user), db=Depends(get_database)):
    return await delete_record(db, "workers", record_id)


@router.get("/resources")
async def resources(current_user=Depends(get_current_user), db=Depends(get_database)):
    return await list_collection(db, "resources")


@router.post("/resources")
async def create_resource(record: FrontendRecord, current_user=Depends(get_current_user), db=Depends(get_database)):
    return await create_record(db, "resources", record.data)


@router.put("/resources/{record_id}")
async def update_resource(record_id: str, record: FrontendRecord, current_user=Depends(get_current_user), db=Depends(get_database)):
    return await update_record(db, "resources", record_id, record.data)


@router.delete("/resources/{record_id}")
async def delete_resource(record_id: str, current_user=Depends(get_current_user), db=Depends(get_database)):
    return await delete_record(db, "resources", record_id)


@router.get("/procurement")
async def procurement(current_user=Depends(get_current_user), db=Depends(get_database)):
    return await list_collection(db, "procurements")


@router.post("/procurement")
async def create_procurement(record: FrontendRecord, current_user=Depends(get_current_user), db=Depends(get_database)):
    return await create_record(db, "procurements", record.data)


@router.put("/procurement/{record_id}")
async def update_procurement(record_id: str, record: FrontendRecord, current_user=Depends(get_current_user), db=Depends(get_database)):
    return await update_record(db, "procurements", record_id, record.data)


@router.delete("/procurement/{record_id}")
async def delete_procurement(record_id: str, current_user=Depends(get_current_user), db=Depends(get_database)):
    return await delete_record(db, "procurements", record_id)


@router.get("/attendance")
async def attendance(current_user=Depends(get_current_user), db=Depends(get_database)):
    return await list_collection(db, "attendance")


@router.post("/attendance")
async def create_attendance(record: FrontendRecord, current_user=Depends(get_current_user), db=Depends(get_database)):
    return await create_record(db, "attendance", record.data)


@router.put("/attendance/{record_id}")
async def update_attendance(record_id: str, record: FrontendRecord, current_user=Depends(get_current_user), db=Depends(get_database)):
    return await update_record(db, "attendance", record_id, record.data)


@router.delete("/attendance/{record_id}")
async def delete_attendance(record_id: str, current_user=Depends(get_current_user), db=Depends(get_database)):
    return await delete_record(db, "attendance", record_id)


@router.get("/reports")
async def reports(current_user=Depends(get_current_user), db=Depends(get_database)):
    return await list_collection(db, "reports")


@router.post("/reports")
async def create_report(record: FrontendRecord, current_user=Depends(get_current_user), db=Depends(get_database)):
    return await create_record(db, "reports", record.data)
