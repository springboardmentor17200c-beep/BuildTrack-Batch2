from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime

from app.core.security import get_current_user
from app.db.mongodb import get_database
from app.modules.notifications.db import create_notification
from app.modules.projects.db import (
    add_milestone,
    create_project,
    delete_project,
    get_project,
    get_projects_by_manager,
    list_projects,
    update_project,
)
from app.modules.projects.models import (
    MilestoneBase,
    Project,
    ProjectCreate,
    ProjectUpdate,
)

router = APIRouter()


def serialize_project(doc: dict) -> dict:
    """Normalize legacy frontend-data project documents to the module schema."""
    project = dict(doc)
    project["_id"] = str(project["_id"])
    project.setdefault("description", project.get("category", ""))
    project.setdefault("project_manager_id", project.get("managerId") or project.get("manager") or "unassigned")
    project.setdefault("start_date", project.get("startDate") or datetime.utcnow())
    project.setdefault("end_date", project.get("endDate") or project.get("start_date") or datetime.utcnow())
    project.setdefault("budget", project.get("budget", 0))
    project.setdefault("status", project.get("status", "planning"))
    project.setdefault("location", "")
    project.setdefault("client", project.get("client") or "")
    project.setdefault("client_email", project.get("client_email") or project.get("clientEmail") or "")
    project.setdefault("milestones", [])
    project.setdefault("created_at", datetime.utcnow())
    project.setdefault("updated_at", datetime.utcnow())

    # Compute progress accurately across milestones and active project timelines
    milestones = project.get("milestones") or []
    if milestones and len(milestones) > 0:
        completed = sum(1 for m in milestones if str(m.get("status", "")).lower() == "completed")
        in_prog = sum(1 for m in milestones if str(m.get("status", "")).lower() in ["in_progress", "in progress", "active"])
        project["progress"] = round(((completed * 100.0) + (in_prog * 50.0)) / len(milestones), 1)
    elif "progress" in project and project["progress"] is not None and float(project["progress"] or 0) > 0:
        project["progress"] = round(float(project["progress"]), 1)
    else:
        st = str(project.get("status", "")).lower()
        if st in ["completed"]:
            project["progress"] = 100.0
        elif st in ["active", "in_progress", "in progress"]:
            # Real timeline progression based on start_date and end_date
            try:
                s_date = project.get("startDate") or project.get("start_date")
                e_date = project.get("endDate") or project.get("end_date")
                s_dt = datetime.fromisoformat(str(s_date).replace("Z", "+00:00").split()[0]) if isinstance(s_date, str) else s_date
                e_dt = datetime.fromisoformat(str(e_date).replace("Z", "+00:00").split()[0]) if isinstance(e_date, str) else e_date

                now = datetime.utcnow()
                if hasattr(s_dt, "tzinfo") and s_dt.tzinfo:
                    s_dt = s_dt.replace(tzinfo=None)
                if hasattr(e_dt, "tzinfo") and e_dt.tzinfo:
                    e_dt = e_dt.replace(tzinfo=None)

                if s_dt and e_dt and e_dt > s_dt:
                    total_days = max(1, (e_dt - s_dt).days)
                    elapsed_days = max(1, (now - s_dt).days)
                    pct = min(95.0, max(15.0, round((elapsed_days / total_days) * 100.0, 1)))
                    project["progress"] = pct
                else:
                    project["progress"] = 45.0
            except Exception:
                project["progress"] = 45.0
        else:
            project["progress"] = 0.0

    return project


@router.post("", response_model=Project)
@router.post("/", response_model=Project)
async def create_project_endpoint(
    project: ProjectCreate,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Create a new project and auto-provision client user if email specified"""
    user_role = (current_user.get("role") or "").strip().lower()
    if user_role not in ["admin", "administrator", "manager", "project manager", "project_manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin or manager can create projects",
        )

    project_data = project.model_dump()
    c_email = str(project_data.get("client_email") or project_data.get("clientEmail") or "").strip().lower()
    if c_email:
        project_data["client_email"] = c_email
        project_data["clientEmail"] = c_email

        # Auto-provision Client login if it doesn't exist yet
        client_user = await db.users.find_one({"email": {"$regex": f"^{c_email}$", "$options": "i"}})
        if not client_user:
            from app.core.security import hash_password
            client_name = project_data.get("client") or c_email.split("@")[0].capitalize()
            new_client = {
                "email": c_email,
                "name": client_name,
                "role": "Client",
                "status": "active",
                "password_hash": hash_password("Client@123"),
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
            inserted = await db.users.insert_one(new_client)
            new_client["_id"] = inserted.inserted_id
            
            # Notify admins of new client registration
            from app.modules.auth.router import notify_admin_of_new_user
            await notify_admin_of_new_user(db, new_client, "Client")

    result = await create_project(db, project_data)
    p_id = str(result["_id"])

    # Trigger project update notification
    target_user = result.get("project_manager_id") or str(current_user["_id"])
    await create_notification(db, {
        "user_id": target_user,
        "title": "Project Created",
        "message": f"Project '{result.get('name', 'New Project')}' has been successfully created.",
        "type": "success",
        "category": "project_update",
        "entity_type": "project",
        "entity_id": p_id,
    })

    return Project(**serialize_project(result))


@router.get("/manager/{manager_id}", response_model=list[Project])
async def get_manager_projects(
    manager_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get all projects by manager"""

    projects = await get_projects_by_manager(db, manager_id)

    return [Project(**serialize_project(project)) for project in projects]


@router.get("", response_model=list[Project])
@router.get("/", response_model=list[Project])
async def list_projects_endpoint(
    skip: int = 0,
    limit: int = 500,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """List all projects (or client-specific projects if logged in as client)"""
    user_role = (current_user.get("role") or "").strip().lower()
    user_email = (current_user.get("email") or "").strip().lower()

    if user_role == "client":
        query = {
            "$or": [
                {"client_email": {"$regex": f"^{user_email}$", "$options": "i"}},
                {"clientEmail": {"$regex": f"^{user_email}$", "$options": "i"}},
                {"client": {"$regex": f"^{user_email}$", "$options": "i"}},
            ]
        }
        projects = await db.projects.find(query).skip(skip).limit(limit).to_list(limit)
    else:
        projects = await list_projects(db, skip, limit)

    return [Project(**serialize_project(project)) for project in projects]


@router.get("/{project_id}", response_model=Project)
async def get_project_endpoint(
    project_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get project by ID"""
    project = await get_project(db, project_id)

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    user_role = (current_user.get("role") or "").strip().lower()
    user_email = (current_user.get("email") or "").strip().lower()
    if user_role == "client":
        p_cemail = str(project.get("client_email") or project.get("clientEmail") or "").strip().lower()
        p_client = str(project.get("client") or "").strip().lower()
        if user_email not in [p_cemail, p_client]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not authorized to view this project",
            )

    return Project(**serialize_project(project))


@router.put("/{project_id}", response_model=Project)
async def update_project_endpoint(
    project_id: str,
    update: ProjectUpdate,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Update project"""

    user_role = (current_user.get("role") or "").strip().lower()
    if user_role not in ["admin", "administrator", "manager", "project manager", "project_manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin or manager can update projects",
        )

    project = await get_project(db, project_id)

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    update_data = update.model_dump(exclude_unset=True)
    c_email = str(update_data.get("client_email") or update_data.get("clientEmail") or "").strip().lower()
    if c_email:
        update_data["client_email"] = c_email
        update_data["clientEmail"] = c_email

        # Auto-provision Client login if it doesn't exist yet
        client_user = await db.users.find_one({"email": {"$regex": f"^{c_email}$", "$options": "i"}})
        if not client_user:
            from app.core.security import hash_password
            client_name = update_data.get("client") or project.get("client") or c_email.split("@")[0].capitalize()
            new_client = {
                "email": c_email,
                "name": client_name,
                "role": "Client",
                "status": "active",
                "password_hash": hash_password("Client@123"),
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
            inserted = await db.users.insert_one(new_client)
            new_client["_id"] = inserted.inserted_id

            from app.modules.auth.router import notify_admin_of_new_user
            await notify_admin_of_new_user(db, new_client, "Client")

    result = await update_project(db, project_id, update_data)
    p_name = result.get("name") or project.get("name") or "Project"
    target_user = result.get("project_manager_id") or str(current_user["_id"])

    await create_notification(db, {
        "user_id": target_user,
        "title": "Project Updated",
        "message": f"Project '{p_name}' has been updated.",
        "type": "info",
        "category": "project_update",
        "entity_type": "project",
        "entity_id": project_id,
    })

    return Project(**serialize_project(result))


@router.delete("/{project_id}")
async def delete_project_endpoint(
    project_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Delete project"""

    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin can delete projects",
        )

    deleted = await delete_project(db, project_id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    return {"message": "Project deleted successfully"}


@router.post("/{project_id}/milestones")
async def add_milestone_endpoint(
    project_id: str,
    milestone: MilestoneBase,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Add milestone to project"""

    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin or manager can add milestones",
        )

    project = await get_project(db, project_id)

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    milestone_data = milestone.model_dump()

    result = await add_milestone(db, project_id, milestone_data)

    result["_id"] = str(result["_id"])
    target_user = project.get("project_manager_id") or str(current_user["_id"])
    await create_notification(db, {
        "user_id": target_user,
        "title": "New Milestone Added",
        "message": f"Milestone '{milestone_data.get('title', 'Milestone')}' was added to project '{project.get('name', '')}'.",
        "type": "info",
        "category": "project_update",
        "entity_type": "project",
        "entity_id": project_id,
    })

    return result

