import { useEffect, useMemo, useRef, useState } from "react";
import { Box, LinearProgress } from "@mui/material";

import DayOffDrawer from "./DayOffDrawer";
import SettingsDrawer from "./SettingsDrawer";
import TaskDrawer from "./TaskDrawer";
import TaskList from "./TaskList";
import TaskToolbar from "./TaskToolbar";
import TimelineChart from "./TimelineChart";
import { getTimelineHeaderHeight, getTimelineMetrics } from "../utils/chartScale";


const TASK_LIST_WIDTH_STORAGE_KEY = "planner-task-list-width";
const DEFAULT_TASK_LIST_WIDTH_PIXELS = 280;
const MIN_TASK_LIST_WIDTH_PIXELS = 260;
const MAX_TASK_LIST_WIDTH_PIXELS = 560;
const DRAG_MOUSE_BUTTON = 0;
const SCROLL_SYNC_TOLERANCE_PIXELS = 1;
const TIMELINE_SCROLL_BEHAVIOR = "smooth";
const UNASSIGNED_ASSIGNEE_LABEL = "Unassigned";
const EMPTY_ASSIGNEE_LABEL = "";
const ASSIGNEE_SORT_NONE = "none";
const ASSIGNEE_SORT_ASCENDING = "ascending";
const ASSIGNEE_SORT_DESCENDING = "descending";
const ASSIGNEE_COLLATOR = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: "base",
});


export default function PlannerShell(props) {
    const {
        tasks,
        dayOffs,
        assignees,
        selectedTaskId,
        selectedTaskIds,
        selectedDayOffDates,
        selectedTask,
        isDrawerOpen,
        isDayOffDrawerOpen,
        isSettingsDrawerOpen,
        isLoading,
        isSaving,
        isAssigneeSaving,
        canRedo,
        canUndo,
        canEditSelectedTask,
        canCopySelectedTasks,
        canPasteCopiedTasks,
        drawerMode,
        dayOffDrawerMode,
        dayOffInitialValues,
        colorMode,
        zoomIndex,
        onAddTaskClick,
        onCreateDayOffs,
        onDayOffActionClick,
        onDayOffDrawerClose,
        onSaveAssignees,
        onColorModeToggle,
        onClearSelection,
        onCreateTask,
        onCopySelectedTasks,
        onDeleteSelectedTask,
        onDrawerClose,
        onEditSelectedTask,
        onMoveTasks,
        onOpenDayOffEdit,
        onOpenTaskEdit,
        onPasteCopiedTasks,
        onRefreshPlanner,
        onRedoTaskChange,
        onResizeTaskDates,
        onSelectTask,
        onSelectDayOffDate,
        onSettingsClick,
        onSettingsDrawerClose,
        onUndoTaskChange,
        onUpdateTask,
        onTimelineZoom,
        selectedDatesHaveDayOff,
    } = props;

    const [taskListWidth, setTaskListWidth] = useState(getInitialTaskListWidth);
    const [isTaskListCollapsed, setIsTaskListCollapsed] = useState(false);
    const [selectedAssigneeFilters, setSelectedAssigneeFilters] = useState([]);
    const [assigneeSortDirection, setAssigneeSortDirection] = useState(ASSIGNEE_SORT_NONE);
    const [highlightedTaskId, setHighlightedTaskId] = useState(null);
    const isSyncingScrollRef = useRef(false);
    const taskListPanelRef = useRef(null);
    const taskListResizeStateRef = useRef(null);
    const timelinePanelRef = useRef(null);
    const timelineHeaderHeight = getTimelineHeaderHeight(zoomIndex);
    const assigneeFilterOptions = useMemo(function memoizeAssigneeFilterOptions() {
        return getAssigneeFilterOptions(tasks);
    }, [tasks]);
    const displayedTasks = useMemo(function memoizeDisplayedTasks() {
        return getDisplayedTasks(tasks, selectedAssigneeFilters, assigneeSortDirection);
    }, [tasks, selectedAssigneeFilters, assigneeSortDirection]);
    const isTaskViewFilteredOrSorted = (
        selectedAssigneeFilters.length > 0
        || assigneeSortDirection !== ASSIGNEE_SORT_NONE
    );
    const taskListColumnWidth = getTaskListColumnWidth(taskListWidth, isTaskListCollapsed);

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
        if (isTaskListCollapsed) {
            return;
        }

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

        const metrics = getTimelineMetrics(displayedTasks, zoomIndex, panel.clientWidth);
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

    function handleTaskHighlight(taskId) {
        setHighlightedTaskId(taskId);
    }

    function handleClearTaskHighlight() {
        setHighlightedTaskId(null);
    }

    function handleTaskListCollapseToggle() {
        const nextIsTaskListCollapsed = !isTaskListCollapsed;

        setIsTaskListCollapsed(nextIsTaskListCollapsed);

        if (nextIsTaskListCollapsed) {
            taskListResizeStateRef.current = null;
            document.body.classList.remove("task-list-resizing");
            handleClearTaskHighlight();
            return;
        }

        window.requestAnimationFrame(function alignTaskListAfterExpand() {
            syncPanelScroll(timelinePanelRef.current, taskListPanelRef.current);
        });
    }

    function handleAssigneeFilterToggle(assigneeLabel) {
        setSelectedAssigneeFilters(function updateSelectedAssigneeFilters(currentFilters) {
            if (currentFilters.includes(assigneeLabel)) {
                return currentFilters.filter(function keepOtherAssigneeFilter(currentFilter) {
                    return currentFilter !== assigneeLabel;
                });
            }

            return [...currentFilters, assigneeLabel];
        });
    }

    function handleAssigneeFiltersClear() {
        setSelectedAssigneeFilters([]);
    }

    function handleAssigneeSortToggle() {
        setAssigneeSortDirection(function updateAssigneeSortDirection(currentDirection) {
            return getNextAssigneeSortDirection(currentDirection);
        });
    }

    function handleTaskListScroll(event) {
        syncPanelScroll(event.currentTarget, timelinePanelRef.current);
    }

    function handleTimelineScroll(event) {
        syncPanelScroll(event.currentTarget, taskListPanelRef.current);
    }

    function syncPanelScroll(sourcePanel, targetPanel) {
        if (!sourcePanel || !targetPanel || isSyncingScrollRef.current) {
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

    const taskListHighlightedTaskId = highlightedTaskId;
    const timelineHighlightedTaskId = highlightedTaskId;

    return (
        <Box className="planner-shell">
            <TaskToolbar
                hasSelectedTask={Boolean(selectedTaskId)}
                hasSelectedDayOffDates={selectedDayOffDates.length > 0}
                isTaskListCollapsed={isTaskListCollapsed}
                canEditSelectedTask={canEditSelectedTask}
                canCopySelectedTasks={canCopySelectedTasks}
                canPasteCopiedTasks={canPasteCopiedTasks}
                canRedo={canRedo}
                canUndo={canUndo}
                isSaving={isSaving}
                onAddTaskClick={onAddTaskClick}
                onCopySelectedTasks={onCopySelectedTasks}
                onDayOffActionClick={onDayOffActionClick}
                onDeleteSelectedTask={onDeleteSelectedTask}
                onEditSelectedTask={onEditSelectedTask}
                onPasteCopiedTasks={onPasteCopiedTasks}
                onRefreshPlanner={onRefreshPlanner}
                onRedoTaskChange={onRedoTaskChange}
                onSettingsClick={onSettingsClick}
                onScrollTimelineFuture={handleScrollTimelineFuture}
                onScrollTimelinePast={handleScrollTimelinePast}
                onScrollTimelineToday={handleScrollTimelineToday}
                onTaskListCollapseToggle={handleTaskListCollapseToggle}
                onUndoTaskChange={onUndoTaskChange}
                selectedDatesHaveDayOff={selectedDatesHaveDayOff}
            />
            {isLoading && <LinearProgress className="planner-progress" />}
            <Box
                className={getPlannerContentClassName(isTaskListCollapsed)}
                sx={{
                    gridTemplateColumns: `${taskListColumnWidth}px minmax(0, 1fr)`,
                    "--planner-task-list-boundary": `${taskListColumnWidth}px`,
                    "--planner-timeline-header-height": `${timelineHeaderHeight}px`,
                }}
            >
                <TaskList
                    panelRef={taskListPanelRef}
                    tasks={displayedTasks}
                    assignees={assignees}
                    assigneeFilterOptions={assigneeFilterOptions}
                    assigneeSortDirection={assigneeSortDirection}
                    highlightedTaskId={taskListHighlightedTaskId}
                    isCollapsed={isTaskListCollapsed}
                    selectedAssigneeFilters={selectedAssigneeFilters}
                    selectedTaskIds={selectedTaskIds}
                    headerHeight={timelineHeaderHeight}
                    onAssigneeFiltersClear={handleAssigneeFiltersClear}
                    onAssigneeFilterToggle={handleAssigneeFilterToggle}
                    onAssigneeSortToggle={handleAssigneeSortToggle}
                    onClearHighlight={handleClearTaskHighlight}
                    onClearSelection={onClearSelection}
                    onHighlightTask={handleTaskHighlight}
                    onPanelScroll={handleTaskListScroll}
                    onResizeStart={handleTaskListResizeStart}
                    onSelectTask={onSelectTask}
                />
                <TimelineChart
                    panelRef={timelinePanelRef}
                    tasks={displayedTasks}
                    dayOffs={dayOffs}
                    highlightedTaskId={timelineHighlightedTaskId}
                    isLoading={isLoading}
                    isRowReorderDisabled={isTaskViewFilteredOrSorted}
                    selectedDayOffDates={selectedDayOffDates}
                    selectedTaskIds={selectedTaskIds}
                    zoomIndex={zoomIndex}
                    onClearHighlight={handleClearTaskHighlight}
                    onClearSelection={onClearSelection}
                    onHighlightTask={handleTaskHighlight}
                    onMoveTasks={onMoveTasks}
                    onOpenTaskEdit={onOpenTaskEdit}
                    onOpenDayOffEdit={onOpenDayOffEdit}
                    onPanelScroll={handleTimelineScroll}
                    onResizeTaskDates={onResizeTaskDates}
                    onSelectTask={onSelectTask}
                    onSelectDayOffDate={onSelectDayOffDate}
                    onTimelineZoom={onTimelineZoom}
                />
            </Box>
            <TaskDrawer
                open={isDrawerOpen}
                isSaving={isSaving}
                assignees={assignees}
                isAssigneeSaving={isAssigneeSaving}
                mode={drawerMode}
                task={selectedTask}
                onClose={onDrawerClose}
                onCreateTask={onCreateTask}
                onSaveAssignees={onSaveAssignees}
                onUpdateTask={onUpdateTask}
            />
            <SettingsDrawer
                open={isSettingsDrawerOpen}
                colorMode={colorMode}
                onClose={onSettingsDrawerClose}
                onColorModeToggle={onColorModeToggle}
            />
            <DayOffDrawer
                open={isDayOffDrawerOpen}
                isSaving={isSaving}
                mode={dayOffDrawerMode}
                initialValues={dayOffInitialValues}
                selectedDates={selectedDayOffDates}
                assignees={assignees}
                onClose={onDayOffDrawerClose}
                onCreateDayOffs={onCreateDayOffs}
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


function getTaskListColumnWidth(taskListWidth, isTaskListCollapsed) {
    if (isTaskListCollapsed) {
        return 0;
    }

    return taskListWidth;
}


function getPlannerContentClassName(isTaskListCollapsed) {
    if (isTaskListCollapsed) {
        return "planner-content planner-content-task-list-collapsed";
    }

    return "planner-content";
}


function getAssigneeFilterOptions(tasks) {
    const assigneeLabels = tasks.map(function mapTaskAssignee(task) {
        return getAssigneeLabel(task);
    });
    const uniqueAssigneeLabels = Array.from(new Set(assigneeLabels));

    return uniqueAssigneeLabels.sort(compareAssigneeLabels);
}


function getDisplayedTasks(tasks, selectedAssigneeFilters, assigneeSortDirection) {
    const indexedTasks = tasks.map(function mapIndexedTask(task, index) {
        return {
            index,
            task,
        };
    });
    const filteredTasks = getFilteredIndexedTasks(indexedTasks, selectedAssigneeFilters);

    if (assigneeSortDirection === ASSIGNEE_SORT_NONE) {
        return filteredTasks.map(function mapFilteredTask(indexedTask) {
            return indexedTask.task;
        });
    }

    const sortedTasks = [...filteredTasks].sort(function compareIndexedTasks(first, second) {
        return compareIndexedTasksByAssignee(first, second, assigneeSortDirection);
    });

    return sortedTasks.map(function mapSortedTask(indexedTask) {
        return indexedTask.task;
    });
}


function getFilteredIndexedTasks(indexedTasks, selectedAssigneeFilters) {
    if (selectedAssigneeFilters.length === 0) {
        return indexedTasks;
    }

    const selectedAssignees = new Set(selectedAssigneeFilters);

    return indexedTasks.filter(function matchSelectedAssignee(indexedTask) {
        return selectedAssignees.has(getAssigneeLabel(indexedTask.task));
    });
}


function compareIndexedTasksByAssignee(first, second, assigneeSortDirection) {
    const firstAssignee = getAssigneeLabel(first.task);
    const secondAssignee = getAssigneeLabel(second.task);
    const assigneeComparison = compareAssigneeLabels(firstAssignee, secondAssignee);

    if (assigneeComparison === 0) {
        return first.index - second.index;
    }

    if (assigneeSortDirection === ASSIGNEE_SORT_DESCENDING) {
        return -assigneeComparison;
    }

    return assigneeComparison;
}


function compareAssigneeLabels(firstAssignee, secondAssignee) {
    return ASSIGNEE_COLLATOR.compare(firstAssignee, secondAssignee);
}


function getNextAssigneeSortDirection(currentDirection) {
    if (currentDirection === ASSIGNEE_SORT_NONE) {
        return ASSIGNEE_SORT_ASCENDING;
    }

    if (currentDirection === ASSIGNEE_SORT_ASCENDING) {
        return ASSIGNEE_SORT_DESCENDING;
    }

    return ASSIGNEE_SORT_NONE;
}


function getAssigneeLabel(task) {
    const assigneeLabel = task.assignee || EMPTY_ASSIGNEE_LABEL;
    const trimmedAssigneeLabel = assigneeLabel.trim();

    if (!trimmedAssigneeLabel) {
        return UNASSIGNED_ASSIGNEE_LABEL;
    }

    return trimmedAssigneeLabel;
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
