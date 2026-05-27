import { useEffect, useRef, useState } from "react";
import { Box, LinearProgress } from "@mui/material";

import SettingsDrawer from "./SettingsDrawer";
import TaskDrawer from "./TaskDrawer";
import TaskList from "./TaskList";
import TaskToolbar from "./TaskToolbar";
import TimelineChart from "./TimelineChart";
import { getTimelineHeaderHeight } from "../utils/chartScale";


const TASK_LIST_WIDTH_STORAGE_KEY = "planner-task-list-width";
const DEFAULT_TASK_LIST_WIDTH_PIXELS = 280;
const MIN_TASK_LIST_WIDTH_PIXELS = 220;
const MAX_TASK_LIST_WIDTH_PIXELS = 560;
const DRAG_MOUSE_BUTTON = 0;


export default function PlannerShell(props) {
    const {
        tasks,
        selectedTaskId,
        selectedTaskIds,
        selectedTask,
        isDrawerOpen,
        isSettingsDrawerOpen,
        isLoading,
        isSaving,
        canRedo,
        canUndo,
        canEditSelectedTask,
        drawerMode,
        colorMode,
        zoomIndex,
        onAddTaskClick,
        onColorModeToggle,
        onClearSelection,
        onCreateTask,
        onDeleteSelectedTask,
        onDrawerClose,
        onEditSelectedTask,
        onMoveTasks,
        onOpenTaskEdit,
        onRedoTaskChange,
        onResizeTaskDates,
        onSelectTask,
        onSettingsClick,
        onSettingsDrawerClose,
        onUndoTaskChange,
        onUpdateTask,
        onTimelineZoom,
    } = props;

    const [taskListWidth, setTaskListWidth] = useState(getInitialTaskListWidth);
    const taskListResizeStateRef = useRef(null);
    const timelineHeaderHeight = getTimelineHeaderHeight(zoomIndex);

    useEffect(function bindTaskListResizeListeners() {
        function handleMouseMove(event) {
            const resizeState = taskListResizeStateRef.current;

            if (!resizeState) {
                return;
            }

            const widthDelta = event.clientX - resizeState.startClientX;
            const nextWidth = getClampedTaskListWidth(resizeState.startWidth + widthDelta);

            resizeState.currentWidth = nextWidth;
            setTaskListWidth(nextWidth);
        }

        function handleMouseUp() {
            const resizeState = taskListResizeStateRef.current;

            if (!resizeState) {
                return;
            }

            saveTaskListWidth(resizeState.currentWidth);
            taskListResizeStateRef.current = null;
            document.body.classList.remove("task-list-resizing");
        }

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);

        return function removeTaskListResizeListeners() {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
            document.body.classList.remove("task-list-resizing");
        };
    }, []);

    function handleTaskListResizeStart(event) {
        if (event.button !== DRAG_MOUSE_BUTTON) {
            return;
        }

        event.preventDefault();

        taskListResizeStateRef.current = {
            startClientX: event.clientX,
            startWidth: taskListWidth,
            currentWidth: taskListWidth,
        };
        document.body.classList.add("task-list-resizing");
    }

    return (
        <Box className="planner-shell">
            <TaskToolbar
                hasSelectedTask={Boolean(selectedTaskId)}
                canEditSelectedTask={canEditSelectedTask}
                canRedo={canRedo}
                canUndo={canUndo}
                isSaving={isSaving}
                onAddTaskClick={onAddTaskClick}
                onDeleteSelectedTask={onDeleteSelectedTask}
                onEditSelectedTask={onEditSelectedTask}
                onRedoTaskChange={onRedoTaskChange}
                onSettingsClick={onSettingsClick}
                onUndoTaskChange={onUndoTaskChange}
            />
            {isLoading && <LinearProgress className="planner-progress" />}
            <Box
                className="planner-content"
                sx={{ gridTemplateColumns: `${taskListWidth}px minmax(0, 1fr)` }}
            >
                <TaskList
                    tasks={tasks}
                    selectedTaskIds={selectedTaskIds}
                    headerHeight={timelineHeaderHeight}
                    onClearSelection={onClearSelection}
                    onResizeStart={handleTaskListResizeStart}
                    onSelectTask={onSelectTask}
                />
                <TimelineChart
                    tasks={tasks}
                    isLoading={isLoading}
                    selectedTaskIds={selectedTaskIds}
                    zoomIndex={zoomIndex}
                    onClearSelection={onClearSelection}
                    onMoveTasks={onMoveTasks}
                    onOpenTaskEdit={onOpenTaskEdit}
                    onResizeTaskDates={onResizeTaskDates}
                    onSelectTask={onSelectTask}
                    onTimelineZoom={onTimelineZoom}
                />
            </Box>
            <TaskDrawer
                open={isDrawerOpen}
                isSaving={isSaving}
                mode={drawerMode}
                task={selectedTask}
                onClose={onDrawerClose}
                onCreateTask={onCreateTask}
                onUpdateTask={onUpdateTask}
            />
            <SettingsDrawer
                open={isSettingsDrawerOpen}
                colorMode={colorMode}
                onClose={onSettingsDrawerClose}
                onColorModeToggle={onColorModeToggle}
            />
        </Box>
    );
}


function getInitialTaskListWidth() {
    const storedTaskListWidth = readStoredTaskListWidth();

    if (storedTaskListWidth) {
        return storedTaskListWidth;
    }

    return DEFAULT_TASK_LIST_WIDTH_PIXELS;
}


function readStoredTaskListWidth() {
    try {
        const storedValue = window.localStorage.getItem(TASK_LIST_WIDTH_STORAGE_KEY);
        const storedWidth = Number(storedValue);

        if (Number.isFinite(storedWidth)) {
            return getClampedTaskListWidth(storedWidth);
        }
    } catch {
        return null;
    }

    return null;
}


function saveTaskListWidth(taskListWidth) {
    try {
        window.localStorage.setItem(TASK_LIST_WIDTH_STORAGE_KEY, String(taskListWidth));
    } catch {
        return;
    }
}


function getClampedTaskListWidth(taskListWidth) {
    return Math.min(
        Math.max(taskListWidth, MIN_TASK_LIST_WIDTH_PIXELS),
        MAX_TASK_LIST_WIDTH_PIXELS,
    );
}
