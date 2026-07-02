# BuildTrack Backend

FastAPI + MongoDB backend for the BuildTrack construction project management platform.

## Setup

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements-dev.txt
copy .env.example .env
uvicorn app.main:app --reload
```

The API will run at `http://127.0.0.1:8000`.

Make sure MongoDB is running locally at `mongodb://localhost:27017`, or update
`MONGODB_URL` in `.env`.

Useful endpoints:

- `GET /health`
- `GET /api/v1/health`
- `GET /docs`

## Project Structure

```text
app/
  api/          API route registration
  core/         Settings, security, shared configuration
  db/           MongoDB client and database dependencies
  modules/      Feature modules such as auth, projects, inventory
  main.py       FastAPI application factory entrypoint
```
