from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: str = Field(
        ...,
        description="admin, manager, engineer, store_manager, finance, contractor, worker, client, vendor"
    )
    status: str = Field(
        default="active",
        description="active, inactive, suspended, pending"
    )
    vendor_id: Optional[str] = Field(
        default=None,
        description="Linked Vendor record ID for vendor users"
    )


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    vendor_id: Optional[str] = None


class User(UserBase):
    id: str = Field(alias="_id")
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True