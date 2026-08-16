from datetime import datetime
from typing import Optional

from bson import ObjectId
from bson.errors import InvalidId
from motor.motor_asyncio import AsyncIOMotorDatabase


# ============================================================
# Helpers
# ============================================================

def _object_id(value: str) -> Optional[ObjectId]:
    """Safely convert a string to MongoDB ObjectId."""
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        return None


# ============================================================
# Worker CRUD
# ============================================================

async def create_worker(db: AsyncIOMotorDatabase, worker_data: dict):
    now = datetime.utcnow()

    worker_data["created_at"] = now
    worker_data["updated_at"] = now

    # Defaults
    worker_data.setdefault("status", "available")
    worker_data.setdefault("category", "SKILLED_WORKER")
    worker_data.setdefault("employment_type", "FULL_TIME")
    worker_data.setdefault("salary_type", "HOURLY")

    result = await db.workers.insert_one(worker_data)

    return await db.workers.find_one({"_id": result.inserted_id})


async def get_worker(db: AsyncIOMotorDatabase, worker_id: str):
    oid = _object_id(worker_id)

    if not oid:
        return None

    return await db.workers.find_one({"_id": oid})


async def update_worker(
    db: AsyncIOMotorDatabase,
    worker_id: str,
    update_data: dict,
):
    oid = _object_id(worker_id)

    if not oid:
        return None

    update_data["updated_at"] = datetime.utcnow()

    await db.workers.update_one(
        {"_id": oid},
        {"$set": update_data},
    )

    return await db.workers.find_one({"_id": oid})


async def delete_worker(db: AsyncIOMotorDatabase, worker_id: str):
    oid = _object_id(worker_id)

    if not oid:
        return False

    result = await db.workers.delete_one({"_id": oid})

    return result.deleted_count > 0


async def list_workers(
    db: AsyncIOMotorDatabase,
    skip: int = 0,
    limit: int = 100,
):
    return await (
        db.workers
        .find()
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
        .to_list(limit)
    )


async def get_workers_by_project(
    db: AsyncIOMotorDatabase,
    project_id: str,
):
    return await db.workers.find(
        {"project_id": project_id}
    ).to_list(None)


async def get_workers_by_skill(
    db: AsyncIOMotorDatabase,
    skill_type: str,
):
    return await db.workers.find(
        {"skill_type": skill_type}
    ).to_list(None)


async def get_workers_by_category(
    db: AsyncIOMotorDatabase,
    category: str,
):
    return await db.workers.find(
        {"category": category}
    ).to_list(None)


async def get_available_workers(
    db: AsyncIOMotorDatabase,
):
    return await db.workers.find(
        {"status": "available"}
    ).to_list(None)


# ============================================================
# Workforce Allocation
# ============================================================

async def create_workforce_allocation(
    db: AsyncIOMotorDatabase,
    allocation_data: dict,
):
    now = datetime.utcnow()

    allocation_data["created_at"] = now
    allocation_data["updated_at"] = now

    allocation_data.setdefault("status", "ACTIVE")

    result = await db.workforce_allocations.insert_one(
        allocation_data
    )

    # Keep worker's current project synchronized.
    worker_id = allocation_data.get("worker_id")
    project_id = allocation_data.get("project_id")

    worker_oid = _object_id(worker_id) if worker_id else None

    if worker_oid and project_id:
        await db.workers.update_one(
            {"_id": worker_oid},
            {
                "$set": {
                    "project_id": project_id,
                    "status": "assigned",
                    "updated_at": now,
                }
            },
        )

    return await db.workforce_allocations.find_one(
        {"_id": result.inserted_id}
    )


async def get_workforce_allocation(
    db: AsyncIOMotorDatabase,
    allocation_id: str,
):
    oid = _object_id(allocation_id)

    if not oid:
        return None

    return await db.workforce_allocations.find_one(
        {"_id": oid}
    )


async def update_workforce_allocation(
    db: AsyncIOMotorDatabase,
    allocation_id: str,
    update_data: dict,
):
    oid = _object_id(allocation_id)

    if not oid:
        return None

    update_data["updated_at"] = datetime.utcnow()

    await db.workforce_allocations.update_one(
        {"_id": oid},
        {"$set": update_data},
    )

    return await db.workforce_allocations.find_one(
        {"_id": oid}
    )


async def delete_workforce_allocation(
    db: AsyncIOMotorDatabase,
    allocation_id: str,
):
    oid = _object_id(allocation_id)

    if not oid:
        return False

    allocation = await db.workforce_allocations.find_one(
        {"_id": oid}
    )

    result = await db.workforce_allocations.delete_one(
        {"_id": oid}
    )

    if result.deleted_count > 0 and allocation:
        worker_id = allocation.get("worker_id")

        worker_oid = (
            _object_id(worker_id)
            if worker_id
            else None
        )

        if worker_oid:
            await db.workers.update_one(
                {"_id": worker_oid},
                {
                    "$set": {
                        "status": "available",
                        "project_id": None,
                        "updated_at": datetime.utcnow(),
                    }
                },
            )

    return result.deleted_count > 0


async def get_project_workforce(
    db: AsyncIOMotorDatabase,
    project_id: str,
):
    return await db.workforce_allocations.find(
        {
            "project_id": project_id,
            "status": "ACTIVE",
        }
    ).sort("created_at", -1).to_list(None)


async def get_worker_allocations(
    db: AsyncIOMotorDatabase,
    worker_id: str,
):
    return await db.workforce_allocations.find(
        {"worker_id": worker_id}
    ).sort("created_at", -1).to_list(None)


# ============================================================
# Attendance CRUD
# ============================================================

async def record_attendance(
    db: AsyncIOMotorDatabase,
    attendance_data: dict,
):
    now = datetime.utcnow()

    attendance_data["created_at"] = now
    attendance_data["updated_at"] = now

    attendance_data.setdefault("status", "absent")

    result = await db.attendance.insert_one(
        attendance_data
    )

    return await db.attendance.find_one(
        {"_id": result.inserted_id}
    )


async def get_attendance(
    db: AsyncIOMotorDatabase,
    attendance_id: str,
):
    oid = _object_id(attendance_id)

    if not oid:
        return None

    return await db.attendance.find_one(
        {"_id": oid}
    )


async def update_attendance(
    db: AsyncIOMotorDatabase,
    attendance_id: str,
    update_data: dict,
):
    oid = _object_id(attendance_id)

    if not oid:
        return None

    update_data["updated_at"] = datetime.utcnow()

    await db.attendance.update_one(
        {"_id": oid},
        {"$set": update_data},
    )

    return await db.attendance.find_one(
        {"_id": oid}
    )


async def delete_attendance(
    db: AsyncIOMotorDatabase,
    attendance_id: str,
):
    oid = _object_id(attendance_id)

    if not oid:
        return False

    result = await db.attendance.delete_one(
        {"_id": oid}
    )

    return result.deleted_count > 0


async def list_attendance(
    db: AsyncIOMotorDatabase,
    skip: int = 0,
    limit: int = 100,
):
    return await (
        db.attendance
        .find()
        .sort("date", -1)
        .skip(skip)
        .limit(limit)
        .to_list(limit)
    )


async def get_worker_attendance(
    db: AsyncIOMotorDatabase,
    worker_id: str,
    start_date: datetime = None,
    end_date: datetime = None,
):
    query = {
        "worker_id": worker_id
    }

    if start_date:
        query.setdefault("date", {})
        query["date"]["$gte"] = start_date

    if end_date:
        query.setdefault("date", {})
        query["date"]["$lte"] = end_date

    return await (
        db.attendance
        .find(query)
        .sort("date", -1)
        .to_list(None)
    )


async def get_project_attendance(
    db: AsyncIOMotorDatabase,
    project_id: str,
    attendance_date: datetime = None,
):
    query = {
        "project_id": project_id
    }

    if attendance_date:
        start = attendance_date.replace(
            hour=0,
            minute=0,
            second=0,
            microsecond=0,
        )

        end = attendance_date.replace(
            hour=23,
            minute=59,
            second=59,
            microsecond=999999,
        )

        query["date"] = {
            "$gte": start,
            "$lte": end,
        }

    return await (
        db.attendance
        .find(query)
        .sort("date", -1)
        .to_list(None)
    )


# ============================================================
# Shift Scheduling
# ============================================================

async def create_shift(
    db: AsyncIOMotorDatabase,
    shift_data: dict,
):
    now = datetime.utcnow()

    shift_data["created_at"] = now
    shift_data["updated_at"] = now

    shift_data.setdefault("status", "ACTIVE")

    result = await db.shifts.insert_one(
        shift_data
    )

    return await db.shifts.find_one(
        {"_id": result.inserted_id}
    )


async def get_shift(
    db: AsyncIOMotorDatabase,
    shift_id: str,
):
    oid = _object_id(shift_id)

    if not oid:
        return None

    return await db.shifts.find_one(
        {"_id": oid}
    )


async def list_shifts(
    db: AsyncIOMotorDatabase,
    project_id: str = None,
):
    query = {}

    if project_id:
        query["project_id"] = project_id

    return await (
        db.shifts
        .find(query)
        .sort("created_at", -1)
        .to_list(None)
    )


async def update_shift(
    db: AsyncIOMotorDatabase,
    shift_id: str,
    update_data: dict,
):
    oid = _object_id(shift_id)

    if not oid:
        return None

    update_data["updated_at"] = datetime.utcnow()

    await db.shifts.update_one(
        {"_id": oid},
        {"$set": update_data},
    )

    return await db.shifts.find_one(
        {"_id": oid}
    )


async def delete_shift(
    db: AsyncIOMotorDatabase,
    shift_id: str,
):
    oid = _object_id(shift_id)

    if not oid:
        return False

    result = await db.shifts.delete_one(
        {"_id": oid}
    )

    return result.deleted_count > 0


async def assign_worker_shift(
    db: AsyncIOMotorDatabase,
    assignment_data: dict,
):
    now = datetime.utcnow()

    assignment_data["created_at"] = now
    assignment_data["updated_at"] = now

    assignment_data.setdefault("status", "ACTIVE")

    result = await db.shift_assignments.insert_one(
        assignment_data
    )

    return await db.shift_assignments.find_one(
        {"_id": result.inserted_id}
    )


async def get_worker_shifts(
    db: AsyncIOMotorDatabase,
    worker_id: str,
):
    return await (
        db.shift_assignments
        .find({"worker_id": worker_id})
        .sort("created_at", -1)
        .to_list(None)
    )


async def get_project_shift_assignments(
    db: AsyncIOMotorDatabase,
    project_id: str,
):
    return await (
        db.shift_assignments
        .find({
            "project_id": project_id,
            "status": "ACTIVE",
        })
        .sort("created_at", -1)
        .to_list(None)
    )


async def delete_shift_assignment(
    db: AsyncIOMotorDatabase,
    assignment_id: str,
):
    oid = _object_id(assignment_id)

    if not oid:
        return False

    result = await db.shift_assignments.delete_one(
        {"_id": oid}
    )

    return result.deleted_count > 0


# ============================================================
# Payroll Monitoring
# ============================================================

async def create_payroll(
    db: AsyncIOMotorDatabase,
    payroll_data: dict,
):
    now = datetime.utcnow()

    payroll_data["created_at"] = now
    payroll_data["updated_at"] = now

    payroll_data.setdefault("status", "DRAFT")

    result = await db.payroll.insert_one(
        payroll_data
    )

    return await db.payroll.find_one(
        {"_id": result.inserted_id}
    )


async def get_payroll(
    db: AsyncIOMotorDatabase,
    payroll_id: str,
):
    oid = _object_id(payroll_id)

    if not oid:
        return None

    return await db.payroll.find_one(
        {"_id": oid}
    )


async def list_payroll(
    db: AsyncIOMotorDatabase,
    project_id: str = None,
    worker_id: str = None,
):
    query = {}

    if project_id:
        query["project_id"] = project_id

    if worker_id:
        query["worker_id"] = worker_id

    return await (
        db.payroll
        .find(query)
        .sort("created_at", -1)
        .to_list(None)
    )


async def update_payroll(
    db: AsyncIOMotorDatabase,
    payroll_id: str,
    update_data: dict,
):
    oid = _object_id(payroll_id)

    if not oid:
        return None

    update_data["updated_at"] = datetime.utcnow()

    await db.payroll.update_one(
        {"_id": oid},
        {"$set": update_data},
    )

    return await db.payroll.find_one(
        {"_id": oid}
    )


async def delete_payroll(
    db: AsyncIOMotorDatabase,
    payroll_id: str,
):
    oid = _object_id(payroll_id)

    if not oid:
        return False

    result = await db.payroll.delete_one(
        {"_id": oid}
    )

    return result.deleted_count > 0


# ============================================================
# Workforce Dashboard / Analytics
# ============================================================

async def get_workforce_summary(
    db: AsyncIOMotorDatabase,
    project_id: str = None,
):
    worker_query = {}

    if project_id:
        worker_query["project_id"] = project_id

    total_workers = await db.workers.count_documents(
        worker_query
    )

    available_workers = await db.workers.count_documents(
        {
            **worker_query,
            "status": "available",
        }
    )

    assigned_workers = await db.workers.count_documents(
        {
            **worker_query,
            "status": "assigned",
        }
    )

    unavailable_workers = await db.workers.count_documents(
        {
            **worker_query,
            "status": "unavailable",
        }
    )

    category_pipeline = [
        {
            "$match": worker_query
        },
        {
            "$group": {
                "_id": "$category",
                "count": {"$sum": 1},
            }
        },
        {
            "$sort": {
                "count": -1
            }
        },
    ]

    category_data = await (
        db.workers
        .aggregate(category_pipeline)
        .to_list(None)
    )

    return {
        "total_workers": total_workers,
        "available_workers": available_workers,
        "assigned_workers": assigned_workers,
        "unavailable_workers": unavailable_workers,
        "category_distribution": category_data,
    }