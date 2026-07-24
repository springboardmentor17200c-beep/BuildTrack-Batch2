from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import get_current_user
from app.db.mongodb import get_database
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

    # Convert ObjectId to string
    result["_id"] = str(result["_id"])

    return Project(**result)


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

    project["_id"] = str(project["_id"])

    return Project(**project)


@router.get("/", response_model=list[Project])
async def list_projects_endpoint(
    skip: int = 0,
    limit: int = 10,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """List all projects"""

    projects = await list_projects(db, skip, limit)

    for project in projects:
        project["_id"] = str(project["_id"])

    return [Project(**project) for project in projects]


@router.get("/manager/{manager_id}", response_model=list[Project])
async def get_manager_projects(
    manager_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get all projects by manager"""

    projects = await get_projects_by_manager(db, manager_id)

    for project in projects:
        project["_id"] = str(project["_id"])

    return [Project(**project) for project in projects]


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

    result["_id"] = str(result["_id"])

    return Project(**result)


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

    return result