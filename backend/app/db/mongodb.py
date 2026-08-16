import dns.resolver
from collections.abc import AsyncGenerator

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.core.config import settings

# Fix Windows/hotspot DNS timeout on MongoDB Atlas SRV lookups
try:
    _resolver = dns.resolver.get_default_resolver()
    _resolver.nameservers = ["8.8.8.8", "1.1.1.1", "8.8.4.4"]
    _resolver.timeout = 2.5
    _resolver.lifetime = 5.0
except Exception:
    pass

mongo_client = AsyncIOMotorClient(settings.mongodb_url)
database = mongo_client[settings.mongodb_db_name]


async def get_database() -> AsyncGenerator[AsyncIOMotorDatabase, None]:
    yield database


async def ping_database() -> bool:
    await database.command("ping")
    return True
