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

## Phase Notes

### Phase 14 Feature 1: Parent task

Parent task support adds a hierarchy layer on top of normal tasks. A parent task stores child references in `childTasks`, while each child remains a normal task row. Parent rows calculate their start date, stop date, and progress from their child task tree, so those computed fields are disabled when a task has children.

Implemented behavior:

- Backend task models and storage validation support `childTasks`.
- Storage rejects invalid hierarchy data, including duplicate parents, missing child ids, self-parent links, cycles, and release or multi-phase tasks acting as parents.
- Task create, edit, bulk edit, undo, redo, cut, copy, paste, delete, and selection now preserve parent-child relationships.
- Selecting a parent selects its full child tree; child tasks can still be selected independently.
- Copy and paste creates new ids and remaps copied child relationships.
- Deleting a parent deletes its descendants.
- The task form includes a `Parent task` id field and an edit-mode copy-id button.
- The task list includes an add-child button and an expand/collapse button for tasks with children.
- Child rows are indented in the task list and stay directly below their parent in the task list and timeline.
- Sorting applies recursively: child lists are sorted first, nested parent children are sorted before their parent-child row is sorted with sibling children, and parent or normal tasks are sorted after child groups without splitting child rows away from parents.
- Filtering keeps ancestor tasks visible so matching child tasks still have their parent context.
- Parent task drag moves the parent and visible children as one block.
- Dragging onto another task can swap task positions or make the dragged task a child, depending on whether the cursor is on the target task bar or the target child-drop area.
- Dragging a child task horizontally outside the parent drop area keeps the parent relationship and changes dates; dragging it vertically outside removes the parent relationship.
- Collapsed parent drop targets remain one row high; new children are appended under the collapsed parent without auto-expanding it.

Testing feedback and fixes:

- The task-list expand/collapse button was moved to the left side of the task name, with the add-child button placed at the right edge of the task-name column.
- Hover text was removed from the expand/collapse and add-child task-list buttons.
- A blank-page reload caused by removing a still-needed tooltip import was fixed.
- The child-drop blue area now starts directly from the task-bar body, without a visual gap.
- The blue area is drawn above other task bars and suppresses other blue areas until it is disabled.
- The blue area only appears after entering the target task bar first, except that dragging an existing child task shows its current parent area immediately.
- Child task drag reorder now follows the same row-target behavior as normal task drag, including above-drop and below-drop cases when releasing on the target row.
- Dragging a parent task group onto a normal task row swaps only with that row. Example: `Task A (+ children), Task B, Task C, Task D, Task E` dragged from `Task A` and released on `Task B` becomes `Task B, Task A (+ children), Task C, Task D, Task E`.

Verification used for this feature:

```powershell
python -m py_compile backend\app.py backend\run.py backend\models.py backend\storage.py
cd frontend
npm run build
```

## Data

Tasks are stored in `backend\data\tasks.json`.

For smoke tests or temporary runs, override the data file:

```powershell
$env:PROJECT_PLANNER_DATA_FILE = "$env:TEMP\project-planner-tasks.json"
python backend\run.py
```
