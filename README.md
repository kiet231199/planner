# Project Planner

Phase 1 project planner with a React, Vite, and MUI frontend plus a FastAPI backend using JSON-file task persistence.

## Local Setup

Install frontend dependencies:

```powershell
cd frontend
npm install
```

Install backend dependencies:

```powershell
cd ..
python -m pip install -r backend\requirements.txt
```

Run the frontend and backend together:

```powershell
cd frontend
npm run dev
```

Press `Ctrl+C` in that terminal to stop both processes.

Open `http://localhost:5173`.

## Verification

Frontend build:

```powershell
cd frontend
npm run build
```

Backend compile check:

```powershell
cd ..
python -m py_compile backend\app.py backend\run.py backend\models.py backend\storage.py
```

## Data

Tasks are stored in `backend\data\tasks.json`.

For smoke tests or temporary runs, override the data file:

```powershell
$env:PROJECT_PLANNER_DATA_FILE = "$env:TEMP\project-planner-tasks.json"
python backend\run.py
```
