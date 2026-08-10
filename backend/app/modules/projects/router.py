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
    project.setdefault("budget", 0)
    project.setdefault("status", project.get("status", "planning"))
    project.setdefault("location", "")
    project.setdefault("milestones", [])
    project.setdefault("created_at", datetime.utcnow())
    project.setdefault("updated_at", datetime.utcnow())
    return project


@router.post("/", response_model=Project)
async def create_project_endpoint(
    project: ProjectCreate,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Create a new project"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin or manager can create projects",
        )

    project_data = project.model_dump()
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


@router.get("/", response_model=list[Project])
async def list_projects_endpoint(
    skip: int = 0,
    limit: int = 10,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """List all projects"""

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

    return Project(**serialize_project(project))


@router.put("/{project_id}", response_model=Project)
async def update_project_endpoint(
    project_id: str,
    update: ProjectUpdate,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Update project"""

    if current_user.get("role") not in ["admin", "manager"]:
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

