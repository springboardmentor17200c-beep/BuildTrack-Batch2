from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class WorkerBase(BaseModel):
    first_name: str
    last_name: str
    email: str
    phone: Optional[str] = None
    skill_type: str = Field(..., description="electrician, plumber, carpenter, etc.")
    hourly_rate: float
    project_id: Optional[str] = None
    status: str = Field(
        default="available",
        description="available, assigned, unavailable"
    )


class WorkerCreate(WorkerBase):
    pass


class WorkerUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None          # Added
    skill_type: Optional[str] = None
    hourly_rate: Optional[float] = None
    project_id: Optional[str] = None
    status: Optional[str] = None


class Worker(WorkerBase):
    id: str = Field(alias="_id")
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True


class AttendanceBase(BaseModel):
    worker_id: str
    date: datetime
    check_in_time: Optional[datetime] = None
    check_out_time: Optional[datetime] = None
    status: str = Field(
        default="absent",
        description="present, absent, leave"
    )
    hours_worked: Optional[float] = None


class AttendanceCreate(AttendanceBase):
    pass


class Attendance(AttendanceBase):
    id: str = Field(alias="_id")
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True