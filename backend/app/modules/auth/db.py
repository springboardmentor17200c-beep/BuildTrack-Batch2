from datetime import datetime

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.security import hash_password
from app.modules.auth.models import UserCreate


async def get_user_by_email(db: AsyncIOMotorDatabase, email: str):
    return await db.users.find_one({"email": email})


async def get_user_by_id(db: AsyncIOMotorDatabase, user_id: str):
    return await db.users.find_one({"_id": ObjectId(user_id)})


async def create_user(db: AsyncIOMotorDatabase, user: UserCreate):
    user_dict = user.model_dump()
    user_dict["password_hash"] = hash_password(user_dict.pop("password"))
    user_dict["created_at"] = datetime.utcnow()
    user_dict["updated_at"] = datetime.utcnow()
    
    result = await db.users.insert_one(user_dict)
    return await db.users.find_one({"_id": result.inserted_id})


async def create_social_user(
    db: AsyncIOMotorDatabase,
    *,
    email: str,
    full_name: str,
    role: str,
    provider: str,
    status: str = "active",
):
    user_dict = {
        "email": email,
        "full_name": full_name,
        "role": role,
        "status": status,
        "auth_provider": provider,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

    result = await db.users.insert_one(user_dict)
    return await db.users.find_one({"_id": result.inserted_id})


async def update_user(db: AsyncIOMotorDatabase, user_id: str, update_data: dict):
    update_data["updated_at"] = datetime.utcnow()
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": update_data}
    )
    return await db.users.find_one({"_id": ObjectId(user_id)})


async def delete_user(db: AsyncIOMotorDatabase, user_id: str):
    result = await db.users.delete_one({"_id": ObjectId(user_id)})
    return result.deleted_count > 0


async def list_users(db: AsyncIOMotorDatabase, skip: int = 0, limit: int = 10):
    return await db.users.find().skip(skip).limit(limit).to_list(limit)
