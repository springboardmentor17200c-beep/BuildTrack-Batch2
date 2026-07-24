from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import get_current_user
from app.db.mongodb import get_database
from app.modules.notifications.db import (
    create_notification,
    delete_notification,
    delete_old_notifications,
    get_notification,
    get_unread_notifications,
    get_user_notifications,
    mark_all_as_read,
    mark_as_read,
)
from app.modules.notifications.models import Notification, NotificationCreate

router = APIRouter()


def serialize_doc(doc: dict) -> dict:
    """Convert MongoDB's ObjectId _id field to a string so Pydantic models validate correctly."""
    doc = dict(doc)  # avoid mutating the original dict
    if "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc


@router.post("/", response_model=Notification)
async def create_notification_endpoint(
    notification: NotificationCreate,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Create new notification"""
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin can create notifications",
        )

    notification_data = notification.model_dump()
    result = await create_notification(db, notification_data)
    return Notification(**serialize_doc(result))


@router.get("/{notification_id}", response_model=Notification)
async def get_notification_endpoint(
    notification_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get notification by ID"""
    notification = await get_notification(db, notification_id)
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    return Notification(**serialize_doc(notification))


@router.get("/user/all", response_model=list[Notification])
async def get_user_notifications_endpoint(
    limit: int = 20,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get current user's notifications"""
    user_id = str(current_user["_id"])
    notifications = await get_user_notifications(db, user_id, limit)
    return [Notification(**serialize_doc(n)) for n in notifications]


@router.get("/user/unread", response_model=list[Notification])
async def get_unread_notifications_endpoint(
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get unread notifications for current user"""
    user_id = str(current_user["_id"])
    notifications = await get_unread_notifications(db, user_id)
    return [Notification(**serialize_doc(n)) for n in notifications]


@router.post("/{notification_id}/read", response_model=Notification)
async def mark_notification_as_read_endpoint(
    notification_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Mark notification as read"""
    notification = await get_notification(db, notification_id)
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )

    # Check if notification belongs to current user
    if notification["receiver_id"] != str(current_user["_id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot mark other user's notifications",
        )

    result = await mark_as_read(db, notification_id)
    return Notification(**serialize_doc(result))


@router.post("/user/read-all")
async def mark_all_notifications_as_read_endpoint(
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Mark all user's notifications as read"""
    user_id = str(current_user["_id"])
    modified_count = await mark_all_as_read(db, user_id)
    return {"message": f"Marked {modified_count} notifications as read"}


@router.delete("/{notification_id}")
async def delete_notification_endpoint(
    notification_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Delete notification"""
    notification = await get_notification(db, notification_id)
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )

    # Check if notification belongs to current user or user is admin
    if (
        notification["receiver_id"] != str(current_user["_id"])
        and current_user.get("role") != "admin"
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete other user's notifications",
        )

    deleted = await delete_notification(db, notification_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    return {"message": "Notification deleted successfully"}


@router.post("/cleanup/old")
async def cleanup_old_notifications_endpoint(
    days: int = 30,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Delete notifications older than specified days"""
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin can cleanup notifications",
        )

    deleted_count = await delete_old_notifications(db, days)
    return {"message": f"Deleted {deleted_count} old notifications"}