# API Routers Implementation Guide

## Overview

Implemented complete API routers with JWT authentication for all BuildTrack modules. All endpoints are role-based protected with the following roles:
- **admin** - Full access to all operations
- **manager** - Can manage projects, resources, workforce, procurement
- **worker** - Read-only access to assigned resources/projects

## Routers Created

### 1. Authentication Router (`/auth`)
**Endpoints:**
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login and get JWT token
- `GET /auth/me` - Get current user profile

**Security:** No auth required for register/login; `/me` requires valid JWT token

---

### 2. Projects Router (`/projects`)
**Endpoints:**
- `POST /projects` - Create project (admin/manager only)
- `GET /projects` - List all projects (paginated)
- `GET /projects/{project_id}` - Get project details
- `GET /projects/manager/{manager_id}` - Filter by manager
- `PUT /projects/{project_id}` - Update project (admin/manager only)
- `DELETE /projects/{project_id}` - Delete project (admin only)
- `POST /projects/{project_id}/milestones` - Add milestone (admin/manager only)

**Auth Required:** All endpoints

---

### 3. Workforce Router (`/workforce`)
**Worker Endpoints:**
- `POST /workforce/workers` - Create worker (admin/manager only)
- `GET /workforce/workers` - List all workers (paginated)
- `GET /workforce/workers/{worker_id}` - Get worker details
- `GET /workforce/workers/project/{project_id}` - Filter by project
- `GET /workforce/workers/skill/{skill_type}` - Filter by skill
- `PUT /workforce/workers/{worker_id}` - Update worker (admin/manager only)
- `DELETE /workforce/workers/{worker_id}` - Delete worker (admin only)

**Attendance Endpoints:**
- `POST /workforce/attendance` - Record attendance (admin/manager only)
- `GET /workforce/attendance/{worker_id}` - Get attendance history

**Auth Required:** All endpoints

---

### 4. Inventory Router (`/inventory`)
**Endpoints:**
- `POST /inventory` - Create inventory item (admin/manager only)
- `GET /inventory` - List all items (paginated)
- `GET /inventory/{item_id}` - Get item details
- `GET /inventory/low-stock` - Get items below reorder level
- `PUT /inventory/{item_id}` - Update item (admin/manager only)
- `DELETE /inventory/{item_id}` - Delete item (admin only)
- `POST /inventory/{item_id}/transactions` - Record transaction (admin/manager only)
- `GET /inventory/{item_id}/transactions` - Get transaction history

**Auth Required:** All endpoints

**Auto-Updates:**
- Quantity automatically updated when transaction recorded
- Status changes: "in_stock" → "low_stock" → "out_of_stock"

---

### 5. Resources Router (`/resources`)
**Endpoints:**
- `POST /resources` - Create resource (admin/manager only)
- `GET /resources` - List all resources (paginated)
- `GET /resources/{resource_id}` - Get resource details
- `GET /resources/available` - Get unassigned resources
- `GET /resources/project/{project_id}` - Filter by project
- `PUT /resources/{resource_id}` - Update resource (admin/manager only)
- `POST /resources/{resource_id}/assign/{worker_id}/{project_id}` - Assign resource (admin/manager only)
- `POST /resources/{resource_id}/unassign` - Return to available (admin/manager only)
- `DELETE /resources/{resource_id}` - Delete resource (admin only)
- `POST /resources/{resource_id}/maintenance` - Record maintenance (admin/manager only)
- `GET /resources/{resource_id}/maintenance` - Get maintenance history

**Auth Required:** All endpoints

---

### 6. Procurement Router (`/procurement`)
**Vendor Endpoints:**
- `POST /procurement/vendors` - Create vendor (admin/manager only)
- `GET /procurement/vendors` - List all vendors (paginated)
- `GET /procurement/vendors/{vendor_id}` - Get vendor details

**Order Endpoints:**
- `POST /procurement` - Create procurement order (admin/manager only)
- `GET /procurement` - List all orders (paginated)
- `GET /procurement/{procurement_id}` - Get order details
- `GET /procurement/status/{status}` - Filter by status
- `GET /procurement/project/{project_id}` - Filter by project
- `GET /procurement/vendor/{vendor_id}` - Filter by vendor
- `PUT /procurement/{procurement_id}` - Update order (admin/manager only)
- `DELETE /procurement/{procurement_id}` - Delete order (admin only)

**Auth Required:** All endpoints

---

### 7. Notifications Router (`/notifications`)
**Endpoints:**
- `POST /notifications` - Create notification (admin only)
- `GET /notifications/{notification_id}` - Get notification
- `GET /notifications/user/all` - Get user's notifications
- `GET /notifications/user/unread` - Get unread notifications
- `POST /notifications/{notification_id}/read` - Mark as read
- `POST /notifications/user/read-all` - Mark all as read
- `DELETE /notifications/{notification_id}` - Delete notification
- `POST /notifications/cleanup/old` - Delete old notifications (admin only)

**Auth Required:** All endpoints

---

### 8. Reports Router (`/reports`)
**Endpoints:**
- `POST /reports` - Generate report (admin/manager only)
- `GET /reports` - List all reports (paginated, newest first)
- `GET /reports/{report_id}` - Get report details
- `GET /reports/type/{report_type}` - Filter by type
- `GET /reports/project/{project_id}` - Filter by project
- `DELETE /reports/{report_id}` - Delete report (admin only)
- `GET /reports/dashboard/metrics` - Get dashboard metrics

**Auth Required:** All endpoints

**Dashboard Metrics Include:**
- Total/active projects
- Total/available resources
- Total workers
- Inventory value & low stock items
- Pending procurements
- Total expenses

---

## Security Implementation

### JWT Token Format
```json
{
  "sub": "user_id",
  "exp": "expiration_timestamp",
  "email": "user@example.com",
  "role": "admin/manager/worker"
}
```

### Authentication Flow
1. User calls `POST /auth/register` to create account
2. User calls `POST /auth/login` with email/password
3. Backend returns `access_token` (valid for 60 minutes)
4. Frontend includes token in `Authorization: Bearer <token>` header
5. Backend validates token and extracts user info

### Role-Based Access Control
```
Admin:      Full access to all operations
Manager:    Can manage projects, resources, workforce, procurement
Worker:     Read-only access (assigned resources/projects only)
```

---

## Error Responses

All endpoints return standard HTTP status codes:

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (invalid token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 500 | Server Error |

**Error Response Format:**
```json
{
  "detail": "Error message"
}
```

---

## Testing Endpoints

### Register
```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "manager@buildtrack.local",
    "full_name": "Project Manager",
    "password": "secure123",
    "role": "manager"
  }'
```

### Login
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "manager@buildtrack.local",
    "password": "secure123"
  }'
```

### Protected Endpoint Example
```bash
curl -X GET http://localhost:8000/api/v1/projects \
  -H "Authorization: Bearer <token_from_login>"
```

---

## API Documentation

View interactive Swagger documentation at:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

---

## File Structure

```
backend/
  app/
    api/
      router.py          ← Main router (includes all module routers)
    core/
      security.py       ← Updated with JWT verification & get_current_user
    modules/
      auth/
        router.py       ← Auth endpoints
        models.py       ← Already created
        db.py          ← Already created
      projects/
        router.py       ← Project endpoints
        models.py       ← Already created
        db.py          ← Already created
      workforce/
        router.py       ← Worker & attendance endpoints
        models.py       ← Already created
        db.py          ← Already created
      inventory/
        router.py       ← Inventory & transaction endpoints
        models.py       ← Already created
        db.py          ← Already created
      resources/
        router.py       ← Resource & maintenance endpoints
        models.py       ← Already created
        db.py          ← Already created
      procurement/
        router.py       ← Vendor & procurement endpoints
        models.py       ← Already created
        db.py          ← Already created
      notifications/
        router.py       ← Notification endpoints
        models.py       ← Already created
        db.py          ← Already created
      reports/
        router.py       ← Report & metrics endpoints
        models.py       ← Already created
        db.py          ← Already created
```

---

## Next Steps

1. **Test endpoints** - Use Swagger UI at `/docs` to test all endpoints
2. **Connect Frontend** - Update Angular auth service to call real backend endpoints
3. **Add Validators** - Implement business logic validators in each router
4. **Create Indexes** - Optimize MongoDB queries with indexes
5. **Add Tests** - Write unit/integration tests for each endpoint

---

## Notes

- All IDs are converted to strings for JSON serialization (MongoDB ObjectId → string)
- Timestamps use UTC (datetime.utcnow())
- Pagination defaults: skip=0, limit=10
- All POST/PUT operations require authentication
- DELETE operations restricted to admin role
- Circular imports avoided by importing db functions inside endpoints
