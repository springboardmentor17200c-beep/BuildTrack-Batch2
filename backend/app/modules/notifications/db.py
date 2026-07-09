from datetime import datetime, timedelta

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase


async def create_notification(db: AsyncIOMotorDatabase, notification_data: dict):
    notification_data["created_at"] = datetime.utcnow()
    notification_data["is_read"] = False
    
    result = await db.notifications.insert_one(notification_data)
    return await db.notifications.find_one({"_id": result.inserted_id})


async def get_notification(db: AsyncIOMotorDatabase, notification_id: str):
    return await db.notifications.find_one({"_id": ObjectId(notification_id)})


async def get_user_notifications(db: AsyncIOMotorDatabase, user_id: str, limit: int = 20):
    return await db.notifications.find({"receiver_id": user_id}).sort("created_at", -1).limit(limit).to_list(limit)


async def get_unread_notifications(db: AsyncIOMotorDatabase, user_id: str):
    return await db.notifications.find({"receiver_id": user_id, "is_read": False}).to_list(None)


async def mark_as_read(db: AsyncIOMotorDatabase, notification_id: str):
    await db.notifications.update_one(
        {"_id": ObjectId(notification_id)},
        {
            "$set": {
                "is_read": True,
                "read_at": datetime.utcnow()
            }
        }
    )
    return await db.notifications.find_one({"_id": ObjectId(notification_id)})


async def mark_all_as_read(db: AsyncIOMotorDatabase, user_id: str):
    result = await db.notifications.update_many(
        {"receiver_id": user_id, "is_read": False},
        {
            "$set": {
                "is_read": True,
                "read_at": datetime.utcnow()
            }
        }
    )
    return result.modified_count


async def delete_notification(db: AsyncIOMotorDatabase, notification_id: str):
    result = await db.notifications.delete_one({"_id": ObjectId(notification_id)})
    return result.deleted_count > 0


async def delete_old_notifications(db: AsyncIOMotorDatabase, days: int = 30):
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    result = await db.notifications.delete_many({"created_at": {"$lt": cutoff_date}})
    return result.deleted_count
