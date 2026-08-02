from io import BytesIO

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from app.core.security import get_current_user
from app.db.mongodb import get_database
from app.modules.reports.db import (
    create_report,
    delete_report,
    get_dashboard_metrics,
    get_procurement_report_summary,
    get_project_report_summary,
    get_report,
    get_reports_by_project,
    get_reports_by_type,
    list_reports,
)
from app.modules.reports.models import DashboardMetrics, Report, ReportCreate

router = APIRouter()


def serialize_doc(doc: dict) -> dict:
    """Convert MongoDB's ObjectId _id field to a string so Pydantic models validate correctly."""
    doc = dict(doc)
    if "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc


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
    return Report(**serialize_doc(result))


@router.get("/", response_model=list[Report])
async def list_reports_endpoint(
    skip: int = 0,
    limit: int = 10,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """List all reports"""
    reports = await list_reports(db, skip, limit)
    return [Report(**serialize_doc(r)) for r in reports]


@router.get("/type/{report_type}", response_model=list[Report])
async def get_reports_by_type_endpoint(
    report_type: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get reports by type"""
    reports = await get_reports_by_type(db, report_type)
    return [Report(**serialize_doc(r)) for r in reports]


@router.get("/project", response_model=list[dict])
async def get_project_summary_report_endpoint(
    project_id: str | None = Query(default=None),
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Project report summary endpoint (compat endpoint: GET /reports/project)."""
    if project_id and len(project_id) != 24:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="project_id must be a valid 24-char Mongo ObjectId",
        )
    return await get_project_report_summary(db, project_id)


@router.get("/project/{project_id}", response_model=list[Report])
async def get_project_reports(
    project_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get all reports for a project"""
    reports = await get_reports_by_project(db, project_id)
    return [Report(**serialize_doc(r)) for r in reports]


@router.get("/procurement", response_model=dict)
async def get_procurement_summary_report_endpoint(
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Procurement report summary endpoint (compat endpoint: GET /reports/procurement)."""
    return await get_procurement_report_summary(db)


@router.get("/dashboard/metrics", response_model=DashboardMetrics)
async def get_dashboard_metrics_endpoint(
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Get dashboard metrics"""
    metrics = await get_dashboard_metrics(db)
    return DashboardMetrics(**serialize_doc(metrics))


@router.get("/export/pdf")
async def export_report_pdf_endpoint(
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Export procurement summary as PDF."""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin or manager can export reports",
        )

    summary = await get_procurement_report_summary(db)
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    pdf.setTitle("Procurement Summary Report")
    y = 800

    pdf.setFont("Helvetica-Bold", 14)
    pdf.drawString(50, y, "BuildTrack Procurement Summary")
    y -= 30

    pdf.setFont("Helvetica", 11)
    for key, value in summary.items():
        pdf.drawString(50, y, f"{key}: {value}")
        y -= 20
        if y <= 40:
            pdf.showPage()
            y = 800

    pdf.save()
    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=procurement-summary.pdf"},
    )


@router.get("/export/excel")
async def export_report_excel_endpoint(
    current_user=Depends(get_current_user),
    db=Depends(get_database),
):
    """Export procurement summary as Excel."""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin or manager can export reports",
        )

    summary = await get_procurement_report_summary(db)
    rows = [{"metric": key, "value": str(value)} for key, value in summary.items()]
    dataframe = pd.DataFrame(rows)

    buffer = BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        dataframe.to_excel(writer, index=False, sheet_name="ProcurementReport")

    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=procurement-summary.xlsx"},
    )


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
    return Report(**serialize_doc(report))


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
