from collections.abc import AsyncGenerator

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.core.config import settings

mongo_client = AsyncIOMotorClient(settings.mongodb_url)
database = mongo_client[settings.mongodb_db_name]


async def get_database() -> AsyncGenerator[AsyncIOMotorDatabase, None]:
    yield database


async def ping_database() -> bool:
    await database.command("ping")
    return True
