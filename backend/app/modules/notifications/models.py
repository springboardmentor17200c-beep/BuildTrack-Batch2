from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class NotificationBase(BaseModel):
    receiver_id: str
    title: str
    message: str
    notification_type: str = Field(..., description="info, warning, alert, success")
    related_entity_id: Optional[str] = None
    related_entity_type: Optional[str] = Field(None, description="project, task, resource, procurement")


class NotificationCreate(NotificationBase):
    pass


class NotificationUpdate(BaseModel):
    is_read: bool


class Notification(NotificationBase):
    id: str = Field(alias="_id")
    is_read: bool = Field(default=False)
    created_at: datetime
    read_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
