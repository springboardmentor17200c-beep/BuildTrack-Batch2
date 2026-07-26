# Database Modules Documentation

This document outlines the database models and operations created for the BuildTrack application.

## Overview

Created comprehensive database modules for all BuildTrack features:

1. **Auth** - User authentication and management
2. **Projects** - Project management with milestones
3. **Workforce** - Worker and attendance management
4. **Inventory** - Material inventory with transaction tracking
5. **Resources** - Equipment and resource management
6. **Procurement** - Vendor and procurement order management
7. **Notifications** - User notifications system
8. **Reports** - Reporting and analytics

## Module Structures

Each module contains:
- `models.py` - Pydantic models for validation and API responses
- `db.py` - Database CRUD operations and queries

### 1. Auth Module
**Collections**: `users`

**Key Models**:
- `User` - User profile with role and status
- `UserCreate` - Registration payload
- `UserUpdate` - Profile update payload

**Operations**:
- `create_user()` - Register new user (hashes password)
- `get_user_by_email()` - Find user by email
- `get_user_by_id()` - Find user by ID
- `update_user()` - Update user profile
- `list_users()` - Paginated user listing

**Database Schema**:
```json
{
  "_id": ObjectId,
  "email": "string (unique)",
  "password_hash": "string",
  "full_name": "string",
  "role": "string (admin, manager, worker)",
  "status": "string (active, inactive, suspended)",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### 2. Projects Module
**Collections**: `projects`

**Key Models**:
- `Project` - Project with nested milestones
- `Milestone` - Project milestone/task
- `ProjectCreate` - Project creation payload
- `ProjectUpdate` - Project update payload

**Operations**:
- `create_project()` - Create new project
- `get_project()` - Get project by ID
- `list_projects()` - List all projects (paginated)
- `get_projects_by_manager()` - Filter by project manager
- `add_milestone()` - Add milestone to project
- `update_project()` - Update project details

**Database Schema**:
```json
{
  "_id": ObjectId,
  "name": "string",
  "description": "string",
  "project_manager_id": "string",
  "start_date": "datetime",
  "end_date": "datetime",
  "budget": "float",
  "status": "string (planning, active, on_hold, completed)",
  "location": "string",
  "milestones": [{
    "_id": ObjectId,
    "title": "string",
    "description": "string",
    "due_date": "datetime",
    "status": "string (pending, in_progress, completed)",
    "created_at": "datetime",
    "updated_at": "datetime"
  }],
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### 3. Workforce Module
**Collections**: `workers`, `attendance`

**Key Models**:
- `Worker` - Employee/worker profile
- `Attendance` - Daily attendance record
- `WorkerCreate` - Worker registration payload
- `WorkerUpdate` - Worker update payload

**Operations**:
- `create_worker()` - Add new worker
- `get_worker()` - Get worker by ID
- `list_workers()` - List all workers (paginated)
- `get_workers_by_project()` - Filter workers by project
- `get_workers_by_skill()` - Filter workers by skill type
- `record_attendance()` - Record daily attendance
- `get_worker_attendance()` - Get attendance history with date range
- `update_attendance()` - Update attendance record

**Database Schemas**:

**Workers Collection**:
```json
{
  "_id": ObjectId,
  "first_name": "string",
  "last_name": "string",
  "email": "string",
  "phone": "string",
  "skill_type": "string (electrician, plumber, carpenter, etc.)",
  "hourly_rate": "float",
  "project_id": "string (optional)",
  "status": "string (available, assigned, unavailable)",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

**Attendance Collection**:
```json
{
  "_id": ObjectId,
  "worker_id": "string",
  "date": "datetime",
  "check_in_time": "datetime",
  "check_out_time": "datetime",
  "status": "string (present, absent, leave)",
  "hours_worked": "float",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### 4. Inventory Module
**Collections**: `inventory`, `inventory_transactions`

**Key Models**:
- `InventoryItem` - Material/inventory item
- `InventoryTransaction` - Transaction record (in/out/adjustment)

**Operations**:
- `create_inventory_item()` - Add new inventory item
- `list_inventory()` - List all items (paginated)
- `get_low_stock_items()` - Get items below reorder level
- `record_transaction()` - Record inventory transaction (auto-updates quantity)
- `get_item_transactions()` - Get transaction history
- `update_inventory_item()` - Update item details

**Database Schemas**:

**Inventory Collection**:
```json
{
  "_id": ObjectId,
  "material_name": "string",
  "quantity": "integer",
  "unit": "string (kg, meter, piece, etc.)",
  "unit_cost": "float",
  "supplier_id": "string",
  "location": "string",
  "status": "string (in_stock, low_stock, out_of_stock)",
  "reorder_level": "integer",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

**Transactions Collection**:
```json
{
  "_id": ObjectId,
  "item_id": "string",
  "transaction_type": "string (in, out, adjustment)",
  "quantity": "integer",
  "reason": "string",
  "created_by": "string",
  "created_at": "datetime"
}
```

### 5. Resources Module
**Collections**: `resources`, `maintenance_logs`

**Key Models**:
- `Resource` - Equipment/resource item
- `MaintenanceLog` - Maintenance record

**Operations**:
- `create_resource()` - Add new resource
- `list_resources()` - List all resources (paginated)
- `get_available_resources()` - Get unassigned resources
- `assign_resource()` - Assign resource to worker/project
- `unassign_resource()` - Return resource to available
- `record_maintenance()` - Record maintenance task
- `get_maintenance_history()` - Get maintenance records

**Database Schemas**:

**Resources Collection**:
```json
{
  "_id": ObjectId,
  "resource_name": "string",
  "resource_type": "string (equipment, tool, vehicle, etc.)",
  "description": "string",
  "acquisition_cost": "float",
  "acquisition_date": "datetime",
  "status": "string (available, in_use, maintenance, retired)",
  "assigned_to": "string (worker_id or null)",
  "assigned_project": "string (project_id or null)",
  "maintenance_schedule": "string",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

**Maintenance Logs Collection**:
```json
{
  "_id": ObjectId,
  "resource_id": "string",
  "maintenance_date": "datetime",
  "maintenance_type": "string (routine, repair, inspection)",
  "description": "string",
  "cost": "float",
  "performed_by": "string",
  "created_at": "datetime"
}
```

### 6. Procurement Module
**Collections**: `vendors`, `procurements`

**Key Models**:
- `Vendor` - Vendor/supplier information
- `Procurement` - Purchase order
- `VendorCreate` - Vendor registration

**Operations**:
- `create_vendor()` - Add new vendor
- `list_vendors()` - List all vendors (paginated)
- `get_vendor()` - Get vendor details
- `create_procurement()` - Create purchase order
- `get_procurement_by_status()` - Filter POs by status
- `get_procurements_by_project()` - Get POs for project
- `get_procurements_by_vendor()` - Get vendor's POs

**Database Schemas**:

**Vendors Collection**:
```json
{
  "_id": ObjectId,
  "vendor_name": "string",
  "contact_person": "string",
  "email": "string",
  "phone": "string",
  "address": "string",
  "city": "string",
  "rating": "float (0-5)",
  "payment_terms": "string",
  "created_at": "datetime"
}
```

**Procurements Collection**:
```json
{
  "_id": ObjectId,
  "vendor_id": "string",
  "project_id": "string (optional)",
  "items": [{
    "item_name": "string",
    "quantity": "integer",
    "unit_price": "float",
    "total_cost": "float"
  }],
  "requested_by": "string",
  "request_date": "datetime",
  "expected_delivery": "datetime",
  "status": "string (pending, approved, ordered, delivered, cancelled)",
  "total_amount": "float",
  "notes": "string",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### 7. Notifications Module
**Collections**: `notifications`

**Key Models**:
- `Notification` - User notification
- `NotificationCreate` - Notification payload
- `NotificationUpdate` - Mark as read

**Operations**:
- `create_notification()` - Send notification to user
- `get_user_notifications()` - Get user's notifications (latest first)
- `get_unread_notifications()` - Get unread only
- `mark_as_read()` - Mark single notification as read
- `mark_all_as_read()` - Mark all user notifications as read
- `delete_old_notifications()` - Clean up old notifications (>30 days)

**Database Schema**:
```json
{
  "_id": ObjectId,
  "receiver_id": "string",
  "title": "string",
  "message": "string",
  "notification_type": "string (info, warning, alert, success)",
  "related_entity_id": "string (optional)",
  "related_entity_type": "string (project, task, resource, procurement)",
  "is_read": "boolean",
  "created_at": "datetime",
  "read_at": "datetime (optional)"
}
```

### 8. Reports Module
**Collections**: `reports`

**Key Models**:
- `Report` - Generated report
- `ReportCreate` - Report generation payload
- `DashboardMetrics` - Key performance metrics

**Operations**:
- `create_report()` - Generate new report
- `list_reports()` - List reports (newest first, paginated)
- `get_reports_by_type()` - Filter by report type
- `get_reports_by_project()` - Get project-specific reports
- `get_dashboard_metrics()` - Calculate key metrics across all modules

**Database Schema**:
```json
{
  "_id": ObjectId,
  "title": "string",
  "description": "string",
  "report_type": "string (project_summary, financial, resource_utilization, workforce, procurement)",
  "project_id": "string (optional)",
  "generated_by": "string",
  "filters": "object",
  "data": "object",
  "file_url": "string",
  "status": "string (pending, in_progress, completed, failed)",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

## Next Steps

1. **Create Router Files** - Add API endpoints for each module
2. **Add Validations** - Implement business logic and validators
3. **Create Indexes** - Optimize MongoDB queries with appropriate indexes
4. **Add Tests** - Write unit and integration tests
5. **API Documentation** - Generate Swagger/OpenAPI documentation

## Usage Example

```python
from app.db.mongodb import get_database
from app.modules.projects.db import create_project

# In an API endpoint
async def create_project_endpoint(project: ProjectCreate, db = Depends(get_database)):
    project_data = project.model_dump()
    result = await create_project(db, project_data)
    return result
```

## Database Connection

All database operations use the Motor async driver. Connection is initialized in `app/db/mongodb.py`:

```python
mongo_client = AsyncIOMotorClient(settings.mongodb_url)
database = mongo_client[settings.mongodb_db_name]
```

## Notes

- All timestamps are in UTC (datetime.utcnow())
- All ID fields use MongoDB ObjectId
- Password hashing is done using `app.core.security.hash_password()`
- Soft deletes not implemented - items are permanently deleted
- Pagination defaults: skip=0, limit=10
