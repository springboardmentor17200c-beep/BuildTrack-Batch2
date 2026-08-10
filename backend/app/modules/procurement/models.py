from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field


Priority = Literal["low", "medium", "high"]
RequestStatus = Literal["pending", "approved", "rejected"]
VendorStatus = Literal["active", "inactive"]
POStatus = Literal["created", "sent", "accepted", "delivered"]
QualityStatus = Literal["pending", "passed", "failed"]
DeliveryStatus = Literal["pending", "partial", "accepted", "rejected"]
InvoiceStatus = Literal["pending", "verified", "approved", "rejected"]
PaymentStatus = Literal["pending", "approved", "paid"]


class MongoModel(BaseModel):
    id: str = Field(alias="_id")

    class Config:
        populate_by_name = True


class VendorBase(BaseModel):
    vendor_name: str = Field(..., min_length=2, max_length=120)
    contact_person: str = Field(..., min_length=2, max_length=120)
    phone: str = Field(..., min_length=7, max_length=20)
    email: EmailStr
    address: str = Field(..., min_length=2, max_length=300)
    materials_supplied: list[str] = Field(default_factory=list)
    rating: float = Field(default=0, ge=0, le=5)
    status: VendorStatus = "active"


class VendorCreate(VendorBase):
    pass


class VendorUpdate(BaseModel):
    vendor_name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    contact_person: Optional[str] = Field(default=None, min_length=2, max_length=120)
    phone: Optional[str] = Field(default=None, min_length=7, max_length=20)
    email: Optional[EmailStr] = None
    address: Optional[str] = Field(default=None, min_length=2, max_length=300)
    materials_supplied: Optional[list[str]] = None
    rating: Optional[float] = Field(default=None, ge=0, le=5)
    status: Optional[VendorStatus] = None


class Vendor(VendorBase, MongoModel):
    created_at: datetime
    updated_at: datetime


class MaterialRequestBase(BaseModel):
    project: str = Field(..., min_length=2, max_length=160)
    material_name: str = Field(..., min_length=2, max_length=160)
    quantity: float = Field(..., gt=0)
    required_date: datetime
    priority: Priority = "medium"
    remarks: Optional[str] = None


class MaterialRequestCreate(MaterialRequestBase):
    pass


class MaterialRequestUpdate(BaseModel):
    project: Optional[str] = Field(default=None, min_length=2, max_length=160)
    material_name: Optional[str] = Field(default=None, min_length=2, max_length=160)
    quantity: Optional[float] = Field(default=None, gt=0)
    required_date: Optional[datetime] = None
    priority: Optional[Priority] = None
    remarks: Optional[str] = None


class ApprovalAction(BaseModel):
    status: Literal["approved", "rejected"]
    comments: Optional[str] = None


class MaterialRequest(MaterialRequestBase, MongoModel):
    request_id: str
    status: RequestStatus = "pending"
    requested_by: Optional[str] = None
    approval_comments: Optional[str] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class PurchaseOrderBase(BaseModel):
    request_id: str = Field(..., min_length=1)
    vendor_id: str = Field(..., min_length=1)
    project: str = Field(..., min_length=2, max_length=160)
    materials: str = Field(..., min_length=2, max_length=200)
    quantity: float = Field(..., gt=0)
    unit_price: float = Field(..., ge=0)
    expected_delivery_date: datetime
    status: POStatus = "created"


class PurchaseOrderCreate(PurchaseOrderBase):
    pass


class PurchaseOrderUpdate(BaseModel):
    vendor_id: Optional[str] = None
    project: Optional[str] = Field(default=None, min_length=2, max_length=160)
    materials: Optional[str] = Field(default=None, min_length=2, max_length=200)
    quantity: Optional[float] = Field(default=None, gt=0)
    unit_price: Optional[float] = Field(default=None, ge=0)
    expected_delivery_date: Optional[datetime] = None
    status: Optional[POStatus] = None


class PurchaseOrder(PurchaseOrderBase, MongoModel):
    po_number: str
    total_cost: float
    created_at: datetime
    updated_at: datetime


class DeliveryBase(BaseModel):
    purchase_order_id: str = Field(..., min_length=1)
    material: str = Field(..., min_length=2, max_length=200)
    quantity_received: float = Field(..., gt=0)
    quality_status: QualityStatus = "pending"
    delivery_date: datetime
    remarks: Optional[str] = None
    status: DeliveryStatus = "pending"


class DeliveryCreate(DeliveryBase):
    pass


class DeliveryUpdate(BaseModel):
    quantity_received: Optional[float] = Field(default=None, gt=0)
    quality_status: Optional[QualityStatus] = None
    delivery_date: Optional[datetime] = None
    remarks: Optional[str] = None
    status: Optional[DeliveryStatus] = None


class Delivery(DeliveryBase, MongoModel):
    created_at: datetime
    updated_at: datetime


class InventoryItem(MongoModel):
    material: str
    stock_quantity: float
    transactions: list[dict] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class InvoiceBase(BaseModel):
    invoice_number: str = Field(..., min_length=2, max_length=80)
    vendor_id: str = Field(..., min_length=1)
    purchase_order_id: str = Field(..., min_length=1)
    amount: float = Field(..., ge=0)
    gst: float = Field(default=0, ge=0)
    invoice_date: datetime
    payment_status: PaymentStatus = "pending"
    attachment_url: Optional[str] = None
    status: InvoiceStatus = "pending"


class InvoiceCreate(InvoiceBase):
    pass


class InvoiceUpdate(BaseModel):
    amount: Optional[float] = Field(default=None, ge=0)
    gst: Optional[float] = Field(default=None, ge=0)
    invoice_date: Optional[datetime] = None
    payment_status: Optional[PaymentStatus] = None
    attachment_url: Optional[str] = None
    status: Optional[InvoiceStatus] = None


class InvoiceAction(BaseModel):
    comments: Optional[str] = None


class Invoice(InvoiceBase, MongoModel):
    verification_comments: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class PaymentBase(BaseModel):
    invoice_id: str = Field(..., min_length=1)
    vendor_id: str = Field(..., min_length=1)
    purchase_order_id: str = Field(..., min_length=1)
    amount: float = Field(..., ge=0)
    status: PaymentStatus = "pending"
    paid_at: Optional[datetime] = None
    remarks: Optional[str] = None


class PaymentCreate(PaymentBase):
    pass


class PaymentUpdate(BaseModel):
    status: Optional[PaymentStatus] = None
    paid_at: Optional[datetime] = None
    remarks: Optional[str] = None


class Payment(PaymentBase, MongoModel):
    created_at: datetime
    updated_at: datetime


class DashboardStats(BaseModel):
    pending_requests: int
    active_purchase_orders: int
    pending_deliveries: int
    pending_payments: int
    recent_activity: list[dict]


class ProcurementItem(BaseModel):
    item_name: str
    quantity: float
    unit_price: float
    total_cost: float


class ProcurementBase(BaseModel):
    vendor_id: str
    project_id: Optional[str] = None
    items: list[ProcurementItem]
    requested_by: str
    request_date: datetime
    expected_delivery: Optional[datetime] = None
    status: str = "pending"
    total_amount: float
    notes: Optional[str] = None


class ProcurementCreate(ProcurementBase):
    pass


class ProcurementUpdate(BaseModel):
    status: Optional[str] = None
    expected_delivery: Optional[datetime] = None
    notes: Optional[str] = None


class Procurement(ProcurementBase, MongoModel):
    created_at: datetime
    updated_at: datetime

