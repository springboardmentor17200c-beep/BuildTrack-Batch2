from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import get_current_user
from app.db.mongodb import get_database
from app.modules.workforce.db import (
    create_worker,
    delete_worker,
    get_worker,
    get_workers_by_project,
    get_workers_by_skill,
    list_workers,
    record_attendance,
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


def serialize_doc(doc: dict) -> dict:
    """Convert MongoDB's ObjectId _id field to a string so Pydantic models validate correctly."""
    doc = dict(doc)  # avoid mutating the original dict
    if "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc


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
    return Worker(**serialize_doc(result))


@router.get("/workers", response_model=list[Worker])
async def list_workers_endpoint(
    skip: int = 0,
    limit: int = 10,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """List all workers"""
    workers = await list_workers(db, skip, limit)
    return [Worker(**serialize_doc(w)) for w in workers]


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
    return Worker(**serialize_doc(worker))


@router.get("/workers/project/{project_id}", response_model=list[Worker])
async def get_project_workers(
    project_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get all workers in a project"""
    workers = await get_workers_by_project(db, project_id)
    return [Worker(**serialize_doc(w)) for w in workers]


@router.get("/workers/skill/{skill_type}", response_model=list[Worker])
async def get_workers_by_skill_type(
    skill_type: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get all workers with specific skill"""
    workers = await get_workers_by_skill(db, skill_type)
    return [Worker(**serialize_doc(w)) for w in workers]


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
    return Worker(**serialize_doc(result))


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
    return Attendance(**serialize_doc(result))


@router.get("/attendance/{worker_id}", response_model=list[Attendance])
async def get_worker_attendance_endpoint(
    worker_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get attendance records for worker"""
    attendance = await get_worker_attendance(db, worker_id)
    return [Attendance(**serialize_doc(a)) for a in attendance]