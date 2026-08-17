from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    project_id: str

    # Assigned to an individual Worker record or a whole category
    assigned_worker_id: Optional[str] = None
    assigned_category: Optional[str] = None

    due_date: Optional[datetime] = None

    status: str = Field(
        default="pending",
        description="pending, completed",
    )


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assigned_worker_id: Optional[str] = None
    assigned_category: Optional[str] = None
    due_date: Optional[datetime] = None
    status: Optional[str] = None


class Task(TaskBase):
    id: str = Field(alias="_id")
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True