import { useEffect, useRef, useState } from "react";
import { Box, LinearProgress } from "@mui/material";

import SettingsDrawer from "./SettingsDrawer";
import TaskDrawer from "./TaskDrawer";
import TaskList from "./TaskList";
import TaskToolbar from "./TaskToolbar";
import TimelineChart from "./TimelineChart";
import { getTimelineHeaderHeight, getTimelineMetrics } from "../utils/chartScale";


const TASK_LIST_WIDTH_STORAGE_KEY = "planner-task-list-width";
const DEFAULT_TASK_LIST_WIDTH_PIXELS = 280;
const MIN_TASK_LIST_WIDTH_PIXELS = 220;
const MAX_TASK_LIST_WIDTH_PIXELS = 560;
const DRAG_MOUSE_BUTTON = 0;
const SCROLL_SYNC_TOLERANCE_PIXELS = 1;
const TIMELINE_SCROLL_BEHAVIOR = "smooth";


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
    const [hoveredTaskId, setHoveredTaskId] = useState(null);
    const [highlightedTaskId, setHighlightedTaskId] = useState(null);
    const isSyncingScrollRef = useRef(false);
    const taskListPanelRef = useRef(null);
    const taskListResizeStateRef = useRef(null);
    const timelinePanelRef = useRef(null);
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

    function handleScrollTimelinePast() {
        scrollTimelineByVisibleRange(-1);
    }

    function handleScrollTimelineFuture() {
        scrollTimelineByVisibleRange(1);
    }

    function handleScrollTimelineToday() {
        const panel = timelinePanelRef.current;

        if (!panel) {
            return;
        }

        const metrics = getTimelineMetrics(tasks, zoomIndex, panel.clientWidth);
        const centeredTodayScrollLeft = getCenteredTodayScrollLeft(panel, metrics);

        scrollTimelineTo(panel, centeredTodayScrollLeft);
    }

    function scrollTimelineByVisibleRange(direction) {
        const panel = timelinePanelRef.current;

        if (!panel) {
            return;
        }

        scrollTimelineTo(panel, panel.scrollLeft + direction * panel.clientWidth);
    }

    function handleTaskHover(taskId) {
        setHoveredTaskId(function updateHoveredTaskId(currentTaskId) {
            if (currentTaskId === taskId) {
                return currentTaskId;
            }

            return taskId;
        });
    }

    function handleTaskHoverEnd() {
        setHoveredTaskId(null);
    }

    function handleTaskHighlight(taskId) {
        setHighlightedTaskId(taskId);
    }

    function handleClearTaskHighlight() {
        setHoveredTaskId(null);
        setHighlightedTaskId(null);
    }

    function handleTaskListScroll(event) {
        syncPanelScroll(event.currentTarget, timelinePanelRef.current);
    }

    function handleTimelineScroll(event) {
        syncPanelScroll(event.currentTarget, taskListPanelRef.current);
    }

    function syncPanelScroll(sourcePanel, targetPanel) {
        if (!targetPanel || isSyncingScrollRef.current) {
            return;
        }

        if (
            Math.abs(targetPanel.scrollTop - sourcePanel.scrollTop)
            <= SCROLL_SYNC_TOLERANCE_PIXELS
        ) {
            return;
        }

        isSyncingScrollRef.current = true;
        targetPanel.scrollTop = sourcePanel.scrollTop;

        window.requestAnimationFrame(function releaseScrollSync() {
            isSyncingScrollRef.current = false;
        });
    }

    const visibleHighlightedTaskId = highlightedTaskId || hoveredTaskId;

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
                onScrollTimelineFuture={handleScrollTimelineFuture}
                onScrollTimelinePast={handleScrollTimelinePast}
                onScrollTimelineToday={handleScrollTimelineToday}
                onUndoTaskChange={onUndoTaskChange}
            />
            {isLoading && <LinearProgress className="planner-progress" />}
            <Box
                className="planner-content"
                sx={{
                    gridTemplateColumns: `${taskListWidth}px minmax(0, 1fr)`,
                    "--planner-timeline-header-height": `${timelineHeaderHeight}px`,
                }}
            >
                <TaskList
                    panelRef={taskListPanelRef}
                    tasks={tasks}
                    highlightedTaskId={visibleHighlightedTaskId}
                    selectedTaskIds={selectedTaskIds}
                    headerHeight={timelineHeaderHeight}
                    onClearHighlight={handleClearTaskHighlight}
                    onClearSelection={onClearSelection}
                    onHighlightTask={handleTaskHighlight}
                    onHoverTask={handleTaskHover}
                    onHoverTaskEnd={handleTaskHoverEnd}
                    onPanelScroll={handleTaskListScroll}
                    onResizeStart={handleTaskListResizeStart}
                    onSelectTask={onSelectTask}
                />
                <TimelineChart
                    panelRef={timelinePanelRef}
                    tasks={tasks}
                    highlightedTaskId={visibleHighlightedTaskId}
                    isLoading={isLoading}
                    selectedTaskIds={selectedTaskIds}
                    zoomIndex={zoomIndex}
                    onClearHighlight={handleClearTaskHighlight}
                    onClearSelection={onClearSelection}
                    onHighlightTask={handleTaskHighlight}
                    onMoveTasks={onMoveTasks}
                    onOpenTaskEdit={onOpenTaskEdit}
                    onPanelScroll={handleTimelineScroll}
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


function getCenteredTodayScrollLeft(panel, metrics) {
    const centeredScrollLeft = (
        metrics.todayScrollLeft
        + metrics.dayWidth / 2
        - panel.clientWidth / 2
    );
    const maxScrollLeft = Math.max(0, panel.scrollWidth - panel.clientWidth);

    return Math.min(Math.max(centeredScrollLeft, 0), maxScrollLeft);
}


function scrollTimelineTo(panel, scrollLeft) {
    const maxScrollLeft = Math.max(0, panel.scrollWidth - panel.clientWidth);
    const clampedScrollLeft = Math.min(Math.max(scrollLeft, 0), maxScrollLeft);

    panel.scrollTo({
        left: clampedScrollLeft,
        behavior: TIMELINE_SCROLL_BEHAVIOR,
    });
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
