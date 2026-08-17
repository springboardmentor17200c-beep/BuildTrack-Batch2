from datetime import datetime

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase


async def create_task(db: AsyncIOMotorDatabase, task_data: dict):
    task_data["created_at"] = datetime.utcnow()
    task_data["updated_at"] = datetime.utcnow()

    result = await db.tasks.insert_one(task_data)
    return await db.tasks.find_one({"_id": result.inserted_id})


async def get_task(db: AsyncIOMotorDatabase, task_id: str):
    return await db.tasks.find_one({"_id": ObjectId(task_id)})


async def update_task(db: AsyncIOMotorDatabase, task_id: str, update_data: dict):
    update_data["updated_at"] = datetime.utcnow()
    await db.tasks.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": update_data}
    )
    return await db.tasks.find_one({"_id": ObjectId(task_id)})


async def delete_task(db: AsyncIOMotorDatabase, task_id: str):
    result = await db.tasks.delete_one({"_id": ObjectId(task_id)})
    return result.deleted_count > 0


async def list_tasks_for_project(db: AsyncIOMotorDatabase, project_id: str):
    return await db.tasks.find({"project_id": project_id}).to_list(None)


async def list_tasks_for_worker(db: AsyncIOMotorDatabase, worker_id: str):
    return await db.tasks.find({"assigned_worker_id": worker_id}).to_list(None)