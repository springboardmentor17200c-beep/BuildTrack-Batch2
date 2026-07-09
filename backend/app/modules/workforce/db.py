from datetime import datetime

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase


# Worker CRUD operations
async def create_worker(db: AsyncIOMotorDatabase, worker_data: dict):
    worker_data["created_at"] = datetime.utcnow()
    worker_data["updated_at"] = datetime.utcnow()
    
    result = await db.workers.insert_one(worker_data)
    return await db.workers.find_one({"_id": result.inserted_id})


async def get_worker(db: AsyncIOMotorDatabase, worker_id: str):
    return await db.workers.find_one({"_id": ObjectId(worker_id)})


async def update_worker(db: AsyncIOMotorDatabase, worker_id: str, update_data: dict):
    update_data["updated_at"] = datetime.utcnow()
    await db.workers.update_one(
        {"_id": ObjectId(worker_id)},
        {"$set": update_data}
    )
    return await db.workers.find_one({"_id": ObjectId(worker_id)})


async def delete_worker(db: AsyncIOMotorDatabase, worker_id: str):
    result = await db.workers.delete_one({"_id": ObjectId(worker_id)})
    return result.deleted_count > 0


async def list_workers(db: AsyncIOMotorDatabase, skip: int = 0, limit: int = 10):
    return await db.workers.find().skip(skip).limit(limit).to_list(limit)


async def get_workers_by_project(db: AsyncIOMotorDatabase, project_id: str):
    return await db.workers.find({"project_id": project_id}).to_list(None)


async def get_workers_by_skill(db: AsyncIOMotorDatabase, skill_type: str):
    return await db.workers.find({"skill_type": skill_type}).to_list(None)


# Attendance CRUD operations
async def record_attendance(db: AsyncIOMotorDatabase, attendance_data: dict):
    attendance_data["created_at"] = datetime.utcnow()
    attendance_data["updated_at"] = datetime.utcnow()
    
    result = await db.attendance.insert_one(attendance_data)
    return await db.attendance.find_one({"_id": result.inserted_id})


async def get_attendance(db: AsyncIOMotorDatabase, attendance_id: str):
    return await db.attendance.find_one({"_id": ObjectId(attendance_id)})


async def update_attendance(db: AsyncIOMotorDatabase, attendance_id: str, update_data: dict):
    update_data["updated_at"] = datetime.utcnow()
    await db.attendance.update_one(
        {"_id": ObjectId(attendance_id)},
        {"$set": update_data}
    )
    return await db.attendance.find_one({"_id": ObjectId(attendance_id)})


async def get_worker_attendance(db: AsyncIOMotorDatabase, worker_id: str, start_date: datetime = None, end_date: datetime = None):
    query = {"worker_id": worker_id}
    if start_date and end_date:
        query["date"] = {"$gte": start_date, "$lte": end_date}
    return await db.attendance.find(query).to_list(None)
