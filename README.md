# 🗂️ Project Planner

Plan projects with a web app.
It has a website and a server.
Your tasks are saved in a data file.

## 🚀 Quick Start

Follow these steps in order.

### 📦 Step 1: Install the Website Tools

Open a terminal.
Go to the frontend folder.

```powershell
cd frontend
npm install
```

This downloads the website tools.

### 🐍 Step 2: Prepare Python

Use Python 3.10 or newer.
On Windows, the `python` command can be a shortcut that does not work.
You may see: `The file cannot be accessed by the system`.
Use a real Python instead.
The easiest way is `uv`.

Create a clean Python space:

```powershell
cd ..
uv venv --python 3.12 --seed .venv
.\.venv\Scripts\activate
```

Without `uv`, use the standard way:

```powershell
python -m venv .venv
.\.venv\Scripts\activate
```

**Keep the Python space active.**

### 🧩 Step 3: Install the Server Tools

Keep the Python space active.
Then run:

```powershell
python -m pip install -r backend\requirements.txt
```

This installs the server tools.

The app works on Python 3.10 and newer.
The saved package ranges fit new Python versions.

### ▶️ Step 4: Start the App

Keep the Python space active.
Then run:

```powershell
cd frontend
npm run dev
```

This starts the website and the server.

**Open this link: http://localhost:5173**

**Press `Ctrl+C` to stop the app.**

## ✅ Check Everything Works

Build the website:

```powershell
cd frontend
npm run build
```

Check the server code:

```powershell
cd ..
python -m py_compile backend\app.py backend\run.py backend\models.py backend\storage.py
```

Run these with the Python space active.

## 📌 How Tasks Are Stored

Your tasks live in one file:
`backend\data\tasks.json`

For a test run, use a different file:

```powershell
$env:PROJECT_PLANNER_DATA_FILE = "$env:TEMP\project-planner-tasks.json"
python backend\run.py
```

Run this from the Python space.

## 🆘 Common Issues

### 😵 `python` Cannot Be Started

Message: `The file cannot be accessed by the system`.
Cause: `python` points to a shortcut that is not real Python.
Fix: use a real Python, or activate your Python space.

### 🔨 Server Tools Cannot Be Installed

What you see: the installer tries to build a package from scratch.
Cause: a very new Python has no ready-made package version yet.
Fix: use ready-made packages only:

```powershell
python -m pip install --only-binary=:all: -r backend\requirements.txt
```

### 🤷 Missing Server Tool

Message: `No module named fastapi`.
Cause: the server tools went to a different Python.
Fix: activate your Python space, then run `npm run dev`.