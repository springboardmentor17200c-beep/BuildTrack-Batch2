from fastapi import APIRouter

from app.modules.auth.router import router as auth_router
from app.modules.frontend_data.router import router as frontend_data_router
from app.modules.health.router import router as health_router
from app.modules.inventory.router import router as inventory_router
from app.modules.notifications.router import router as notifications_router
from app.modules.procurement.router import router as procurement_router
from app.modules.projects.router import router as projects_router
from app.modules.reports.router import router as reports_router
from app.modules.resources.router import router as resources_router
from app.modules.workforce.router import router as workforce_router

api_router = APIRouter()

# Auth routes
api_router.include_router(auth_router, prefix="/auth", tags=["Authentication"])

# Frontend-friendly MongoDB data routes
api_router.include_router(frontend_data_router, prefix="/frontend-data", tags=["Frontend Data"])

# Health check
api_router.include_router(health_router, prefix="/health", tags=["Health"])

# Projects
api_router.include_router(projects_router, prefix="/projects", tags=["Projects"])

# Workforce
api_router.include_router(workforce_router, prefix="/workforce", tags=["Workforce"])

# Inventory
api_router.include_router(inventory_router, prefix="/inventory", tags=["Inventory"])

# Resources
api_router.include_router(resources_router, prefix="/resources", tags=["Resources"])

# Procurement
api_router.include_router(procurement_router, prefix="/procurement", tags=["Procurement"])

# Notifications
api_router.include_router(notifications_router, prefix="/notifications", tags=["Notifications"])

# Reports
api_router.include_router(reports_router, prefix="/reports", tags=["Reports"])
