from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field


# =====================================================
# Vendor Models
# =====================================================

class VendorBase(BaseModel):
    vendor_name: str = Field(..., min_length=2, max_length=120)
    contact_person: str = Field(..., min_length=2, max_length=120)
    email: EmailStr
    phone: str = Field(..., min_length=7, max_length=20)
    address: Optional[str] = None
    city: Optional[str] = None
    rating: float = Field(default=5.0, ge=0, le=5)
    payment_terms: Optional[str] = None


class VendorCreate(VendorBase):
    pass


class VendorUpdate(BaseModel):
    vendor_name: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    rating: Optional[float] = Field(default=None, ge=0, le=5)
    payment_terms: Optional[str] = None


class Vendor(BaseModel):
    id: str = Field(alias="_id")
    vendor_name: str
    contact_person: str
    email: str
    phone: str
    address: Optional[str] = None
    city: Optional[str] = None
    rating: float
    payment_terms: Optional[str] = None
    created_at: datetime

    class Config:
        populate_by_name = True


# =====================================================
# Procurement Item Models
# =====================================================

class ProcurementItemBase(BaseModel):
    item_name: str = Field(..., min_length=2, max_length=150)
    quantity: int = Field(..., gt=0)
    unit_price: float = Field(..., ge=0)
    total_cost: float = Field(..., ge=0)


# =====================================================
# Procurement Models
# =====================================================

class ProcurementBase(BaseModel):
    vendor_id: str = Field(..., min_length=1)
    project_id: Optional[str] = None

    # Properly typed list of procurement items
    items: list[ProcurementItemBase]

    requested_by: str = Field(..., min_length=2, max_length=120)
    request_date: datetime
    expected_delivery: Optional[datetime] = None

    status: Literal["pending", "approved", "ordered", "delivered", "cancelled"] = Field(
        default="pending",
        description="pending, approved, ordered, delivered, cancelled",
    )

    total_amount: float = Field(..., ge=0)
    notes: Optional[str] = None


class ProcurementCreate(ProcurementBase):
    pass


class ProcurementUpdate(BaseModel):
    status: Optional[Literal["pending", "approved", "ordered", "delivered", "cancelled"]] = None
    expected_delivery: Optional[datetime] = None
    notes: Optional[str] = None


class Procurement(BaseModel):
    id: str = Field(alias="_id")
    vendor_id: str
    project_id: Optional[str] = None
    items: list[ProcurementItemBase]
    requested_by: str
    request_date: datetime
    expected_delivery: Optional[datetime] = None
    status: str
    total_amount: float
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True


# =====================================================
# Purchase Order Models
# =====================================================

class PurchaseOrderBase(BaseModel):
    procurement_id: str = Field(..., min_length=1)
    vendor_id: str = Field(..., min_length=1)
    po_number: str = Field(..., min_length=2, max_length=60)
    issue_date: datetime
    expected_delivery: Optional[datetime] = None
    status: Literal["draft", "issued", "partially_received", "completed", "cancelled"] = "draft"
    total_amount: float = Field(..., ge=0)
    notes: Optional[str] = None


class PurchaseOrderCreate(PurchaseOrderBase):
    pass


class PurchaseOrderUpdate(BaseModel):
    expected_delivery: Optional[datetime] = None
    status: Optional[Literal["draft", "issued", "partially_received", "completed", "cancelled"]] = None
    total_amount: Optional[float] = Field(default=None, ge=0)
    notes: Optional[str] = None


class PurchaseOrder(PurchaseOrderBase):
    id: str = Field(alias="_id")
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True


# =====================================================
# Invoice Tracking Models
# =====================================================

class InvoiceBase(BaseModel):
    purchase_order_id: str = Field(..., min_length=1)
    invoice_number: str = Field(..., min_length=2, max_length=60)
    vendor_id: str = Field(..., min_length=1)
    invoice_date: datetime
    due_date: Optional[datetime] = None
    amount: float = Field(..., ge=0)
    status: Literal["pending", "approved", "paid", "overdue", "rejected"] = "pending"
    notes: Optional[str] = None


class InvoiceCreate(InvoiceBase):
    pass


class InvoiceUpdate(BaseModel):
    due_date: Optional[datetime] = None
    amount: Optional[float] = Field(default=None, ge=0)
    status: Optional[Literal["pending", "approved", "paid", "overdue", "rejected"]] = None
    notes: Optional[str] = None


class Invoice(InvoiceBase):
    id: str = Field(alias="_id")
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True