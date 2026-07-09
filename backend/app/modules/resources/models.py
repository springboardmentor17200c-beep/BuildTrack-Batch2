from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ResourceBase(BaseModel):
    resource_name: str
    resource_type: str = Field(..., description="equipment, tool, vehicle, etc.")
    description: Optional[str] = None
    acquisition_cost: float
    acquisition_date: datetime
    status: str = Field(default="available", description="available, in_use, maintenance, retired")
    assigned_to: Optional[str] = None
    assigned_project: Optional[str] = None
    maintenance_schedule: Optional[str] = None


class ResourceCreate(ResourceBase):
    pass


class ResourceUpdate(BaseModel):
    resource_name: Optional[str] = None
    status: Optional[str] = None
    assigned_to: Optional[str] = None
    assigned_project: Optional[str] = None


class Resource(ResourceBase):
    id: str = Field(alias="_id")
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True


class MaintenanceLog(BaseModel):
    resource_id: str
    maintenance_date: datetime
    maintenance_type: str = Field(..., description="routine, repair, inspection")
    description: str
    cost: float = 0.0
    performed_by: str
    id: str = Field(alias="_id")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
