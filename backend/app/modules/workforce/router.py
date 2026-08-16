from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime

from app.core.security import get_current_user
from app.db.mongodb import get_database
from app.modules.workforce.db import (
    create_worker,
    delete_attendance,
    delete_worker,
    get_attendance,
    get_worker,
    get_workers_by_project,
    get_workers_by_skill,
    list_attendance,
    list_workers,
    record_attendance,
    update_attendance,
    update_worker,
    get_worker_attendance,
)
from app.modules.workforce.models import (
    Worker,
    WorkerCreate,
    WorkerUpdate,
    Attendance,
    AttendanceCreate,
)

router = APIRouter()


def serialize_worker_doc(doc: dict) -> dict:
    """Convert MongoDB's ObjectId _id field to a string so Pydantic models validate correctly."""
    doc = dict(doc)  # avoid mutating the original dict
    if "_id" in doc:
        doc["_id"] = str(doc["_id"])

    name_parts = str(doc.get("name") or "Worker").split()
    doc.setdefault("first_name", name_parts[0] if name_parts else "Worker")
    doc.setdefault("last_name", " ".join(name_parts[1:]) if len(name_parts) > 1 else "-")
    doc.setdefault("email", doc.get("email") or f"{str(doc['_id'])}@buildtrack.local")
    doc.setdefault("phone", doc.get("phone") or doc.get("contact"))
    doc.setdefault("skill_type", doc.get("skillType") or doc.get("role") or "General")
    doc.setdefault("hourly_rate", doc.get("hourlyRate") or doc.get("salary") or 0)
    doc.setdefault("project_id", doc.get("assignedProjectId") or doc.get("projectId"))
    doc.setdefault("status", doc.get("status") or "available")
    doc.setdefault("created_at", datetime.utcnow())
    doc.setdefault("updated_at", datetime.utcnow())
    return doc


def serialize_attendance_doc(doc: dict) -> dict:
    """Convert legacy attendance documents to the attendance module schema."""
    doc = dict(doc)
    if "_id" in doc:
        doc["_id"] = str(doc["_id"])
    doc.setdefault("worker_id", doc.get("workerId") or doc.get("worker_id") or "")
    doc.setdefault("date", doc.get("date") or datetime.utcnow())
    doc.setdefault("check_in_time", normalize_attendance_time(doc.get("checkIn") or doc.get("check_in_time"), doc["date"]))
    doc.setdefault("check_out_time", normalize_attendance_time(doc.get("checkOut") or doc.get("check_out_time"), doc["date"]))
    doc.setdefault("status", doc.get("status") or "absent")
    doc.setdefault("hours_worked", doc.get("hoursWorked"))
    doc.setdefault("created_at", datetime.utcnow())
    doc.setdefault("updated_at", datetime.utcnow())
    return doc


def normalize_attendance_time(value, date_value):
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    text = str(value)
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        pass

    date_text = str(date_value).split("T")[0].split(" ")[0]
    try:
        return datetime.fromisoformat(f"{date_text}T{text}")
    except ValueError:
        return None


from app.modules.notifications.db import create_notification

# Worker endpoints
@router.post("/workers", response_model=Worker)
async def create_worker_endpoint(
    worker: WorkerCreate,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Create a new worker"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin or manager can create workers",
        )

    worker_data = worker.model_dump()
    result = await create_worker(db, worker_data)

    # Notify current manager / creator about task assignment / worker assignment
    await create_notification(db, {
        "user_id": str(current_user["_id"]),
        "title": "New Task / Worker Assigned",
        "message": f"Worker '{result.get('name') or 'Worker'}' assigned as '{result.get('skill_type', 'General')}'.",
        "type": "info",
        "category": "task_assignment",
        "entity_type": "task",
        "entity_id": str(result["_id"]),
    })

    return Worker(**serialize_worker_doc(result))


@router.get("/workers", response_model=list[Worker])
async def list_workers_endpoint(
    skip: int = 0,
    limit: int = 10,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """List all workers"""
    workers = await list_workers(db, skip, limit)
    return [Worker(**serialize_worker_doc(w)) for w in workers]


@router.get("/workers/project/{project_id}", response_model=list[Worker])
async def get_project_workers(
    project_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get all workers in a project"""
    workers = await get_workers_by_project(db, project_id)
    return [Worker(**serialize_worker_doc(w)) for w in workers]


@router.get("/workers/skill/{skill_type}", response_model=list[Worker])
async def get_workers_by_skill_type(
    skill_type: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get all workers with specific skill"""
    workers = await get_workers_by_skill(db, skill_type)
    return [Worker(**serialize_worker_doc(w)) for w in workers]


@router.get("/workers/{worker_id}", response_model=Worker)
async def get_worker_endpoint(
    worker_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get worker by ID"""
    worker = await get_worker(db, worker_id)
    if not worker:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Worker not found",
        )
    return Worker(**serialize_worker_doc(worker))


@router.put("/workers/{worker_id}", response_model=Worker)
async def update_worker_endpoint(
    worker_id: str,
    update: WorkerUpdate,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Update worker"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin or manager can update workers",
        )

    worker = await get_worker(db, worker_id)
    if not worker:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Worker not found",
        )

    update_data = update.model_dump(exclude_unset=True)
    result = await update_worker(db, worker_id, update_data)
    return Worker(**serialize_worker_doc(result))


@router.delete("/workers/{worker_id}")
async def delete_worker_endpoint(
    worker_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Delete worker"""
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin can delete workers",
        )

    deleted = await delete_worker(db, worker_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Worker not found",
        )
    return {"message": "Worker deleted successfully"}


# Attendance endpoints
@router.post("/attendance", response_model=Attendance)
async def record_attendance_endpoint(
    attendance: AttendanceCreate,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Record worker attendance"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin or manager can record attendance",
        )

    attendance_data = attendance.model_dump()
    result = await record_attendance(db, attendance_data)

    status_val = str(result.get("status") or "absent").lower()
    msg_type = "alert" if status_val in ["absent", "late"] else "info"

    await create_notification(db, {
        "user_id": str(current_user["_id"]),
        "title": "Attendance Alert",
        "message": f"Worker attendance recorded: Status '{status_val}'.",
        "type": msg_type,
        "category": "attendance_alert",
        "entity_type": "attendance",
        "entity_id": str(result["_id"]),
    })

    return Attendance(**serialize_attendance_doc(result))



@router.get("/attendance", response_model=list[Attendance])
async def list_attendance_endpoint(
    skip: int = 0,
    limit: int = 100,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """List attendance records"""
    attendance = await list_attendance(db, skip, limit)
    return [Attendance(**serialize_attendance_doc(a)) for a in attendance]


@router.put("/attendance/{attendance_id}", response_model=Attendance)
async def update_attendance_endpoint(
    attendance_id: str,
    attendance: AttendanceCreate,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Update attendance record"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin or manager can update attendance",
        )

    existing = await get_attendance(db, attendance_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attendance record not found",
        )

    result = await update_attendance(db, attendance_id, attendance.model_dump())
    return Attendance(**serialize_attendance_doc(result))


@router.delete("/attendance/{attendance_id}")
async def delete_attendance_endpoint(
    attendance_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Delete attendance record"""
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin can delete attendance records",
        )

    deleted = await delete_attendance(db, attendance_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attendance record not found",
        )
    return {"message": "Attendance record deleted successfully"}


@router.get("/attendance/{worker_id}", response_model=list[Attendance])
async def get_worker_attendance_endpoint(
    worker_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get attendance records for worker"""
    attendance = await get_worker_attendance(db, worker_id)
    return [Attendance(**serialize_attendance_doc(a)) for a in attendance]
