from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class MilestoneBase(BaseModel):
    title: str
    description: Optional[str] = None
    due_date: datetime
    status: str = Field(default="pending", description="pending, in_progress, completed")


class Milestone(MilestoneBase):
    id: str = Field(alias="_id")
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True


class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None
    project_manager_id: str
    start_date: datetime
    end_date: datetime
    budget: float
    status: str = Field(default="planning", description="planning, active, on_hold, completed")
    location: Optional[str] = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    budget: Optional[float] = None
    end_date: Optional[datetime] = None


class Project(ProjectBase):
    id: str = Field(alias="_id")
    milestones: list = Field(default=[])
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True
