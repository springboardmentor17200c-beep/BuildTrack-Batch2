# BuildTrack Connected App

This folder combines the BuildTrack Batch 2 FastAPI backend with the separate
`buildtrack-app` Angular frontend.

## Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements-dev.txt
copy .env.example .env
uvicorn app.main:app --reload
```

The API runs at `http://127.0.0.1:8000`.

MongoDB must be running locally, or `MONGODB_URL` must be updated in
`backend\.env`.

## Frontend

```powershell
cd frontend
npm install
npm run start:api
```

The Angular app runs at `http://localhost:4200`.

## Connected Auth Flow

- Login calls `POST http://127.0.0.1:8000/api/v1/auth/login`.
- Register calls `POST http://127.0.0.1:8000/api/v1/auth/register`, then logs in.
- The frontend stores the returned JWT and sends it as a bearer token.
- Dashboard/project/resource data is still the frontend's existing mock data.
