from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import get_current_user
from app.db.mongodb import get_database
from app.modules.reports.db import (
    create_report,
    delete_report,
    get_dashboard_metrics,
    get_report,
    get_reports_by_project,
    get_reports_by_type,
    list_reports,
)
from app.modules.reports.models import DashboardMetrics, Report, ReportCreate

router = APIRouter()


@router.post("/", response_model=Report)
async def create_report_endpoint(
    report: ReportCreate,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Generate new report"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin or manager can generate reports",
        )

    report_data = report.model_dump()
    result = await create_report(db, report_data)
    return Report(**result, id=str(result["_id"]))


@router.get("/", response_model=list[Report])
async def list_reports_endpoint(
    skip: int = 0,
    limit: int = 10,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """List all reports"""
    reports = await list_reports(db, skip, limit)
    return [Report(**r, id=str(r["_id"])) for r in reports]


@router.get("/{report_id}", response_model=Report)
async def get_report_endpoint(
    report_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get report by ID"""
    report = await get_report(db, report_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found",
        )
    return Report(**report, id=str(report["_id"]))


@router.get("/type/{report_type}", response_model=list[Report])
async def get_reports_by_type_endpoint(
    report_type: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get reports by type"""
    reports = await get_reports_by_type(db, report_type)
    return [Report(**r, id=str(r["_id"])) for r in reports]


@router.get("/project/{project_id}", response_model=list[Report])
async def get_project_reports(
    project_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get all reports for a project"""
    reports = await get_reports_by_project(db, project_id)
    return [Report(**r, id=str(r["_id"])) for r in reports]


@router.delete("/{report_id}")
async def delete_report_endpoint(
    report_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Delete report"""
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin can delete reports",
        )

    deleted = await delete_report(db, report_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found",
        )
    return {"message": "Report deleted successfully"}


@router.get("/dashboard/metrics", response_model=DashboardMetrics)
async def get_dashboard_metrics_endpoint(
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get dashboard metrics"""
    metrics = await get_dashboard_metrics(db)
    return DashboardMetrics(**metrics)
