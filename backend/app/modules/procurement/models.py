from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class VendorBase(BaseModel):
    vendor_name: str
    contact_person: str
    email: str
    phone: str
    address: Optional[str] = None
    city: Optional[str] = None
    rating: float = Field(default=5.0, ge=0, le=5)
    payment_terms: Optional[str] = None


class VendorCreate(VendorBase):
    pass


class VendorUpdate(BaseModel):
    vendor_name: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    rating: Optional[float] = None


class Vendor(VendorBase):
    id: str = Field(alias="_id")
    created_at: datetime

    class Config:
        populate_by_name = True


class ProcurementItemBase(BaseModel):
    item_name: str
    quantity: int
    unit_price: float
    total_cost: float


class ProcurementBase(BaseModel):
    vendor_id: str
    project_id: Optional[str] = None
    items: list[dict]  # List of ProcurementItemBase
    requested_by: str
    request_date: datetime
    expected_delivery: Optional[datetime] = None
    status: str = Field(default="pending", description="pending, approved, ordered, delivered, cancelled")
    total_amount: float
    notes: Optional[str] = None


class ProcurementCreate(ProcurementBase):
    pass


class ProcurementUpdate(BaseModel):
    status: Optional[str] = None
    expected_delivery: Optional[datetime] = None
    notes: Optional[str] = None


class Procurement(ProcurementBase):
    id: str = Field(alias="_id")
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True
