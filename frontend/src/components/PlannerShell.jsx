import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Box, LinearProgress } from "@mui/material";

import DayOffDrawer from "./DayOffDrawer";
import SettingsDrawer from "./SettingsDrawer";
import TaskDrawer from "./TaskDrawer";
import TaskList from "./TaskList";
import TaskToolbar from "./TaskToolbar";
import TimelineChart from "./TimelineChart";
import {
    getTimelineDateAtOffset,
    getTimelineHeaderHeight,
    getTimelineOffsetForDate,
    getTimelineScaleMetrics,
} from "../utils/chartScale";


const TASK_LIST_WIDTH_STORAGE_KEY = "planner-task-list-width";
const DEFAULT_TASK_LIST_WIDTH_PIXELS = 280;
const MIN_TASK_LIST_WIDTH_PIXELS = 260;
const MAX_TASK_LIST_WIDTH_PIXELS = 560;
const COMPACT_LAYOUT_MAX_WIDTH_PIXELS = 900;
const SHORT_VIEWPORT_MAX_HEIGHT_PIXELS = 560;
const TOOLBAR_PANEL_WIDTH_PIXELS = 56;
const MIN_TIMELINE_WIDTH_PIXELS = 360;
const COMPACT_TASK_LIST_WIDTH_PIXELS = 240;
const COMPACT_MIN_TASK_LIST_WIDTH_PIXELS = 180;
const COMPACT_MIN_TIMELINE_WIDTH_PIXELS = 240;
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
const EMPTY_SHELL_SIZE = {
    width: 0,
    height: 0,
};


export default function PlannerShell(props) {
    const {
        tasks,
        dayOffs,
        assignees,
        selectedTaskId,
        selectedTaskIds,
        selectedDayOffDates,
        selectedTask,
        selectedTasks,
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
        showTimelineHorizontalGridLines,
        zoomIndex,
        zoomMode,
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
        onUpdateTasks,
        onTimelineHorizontalGridLinesToggle,
        onTimelineZoom,
        onTimelineZoomModeChange,
        selectedDatesHaveDayOff,
    } = props;

    const [taskListWidth, setTaskListWidth] = useState(getInitialTaskListWidth);
    const [isTaskListCollapsed, setIsTaskListCollapsed] = useState(false);
    const [isCompactTaskListCollapsed, setIsCompactTaskListCollapsed] = useState(true);
    const [shellSize, setShellSize] = useState(getInitialShellSize);
    const [selectedAssigneeFilters, setSelectedAssigneeFilters] = useState([]);
    const [assigneeSortDirection, setAssigneeSortDirection] = useState(ASSIGNEE_SORT_NONE);
    const [highlightedTaskId, setHighlightedTaskId] = useState(null);
    const isSyncingScrollRef = useRef(false);
    const shellRef = useRef(null);
    const shellResizeFrameIdRef = useRef(null);
    const taskListPanelRef = useRef(null);
    const taskListResizeStateRef = useRef(null);
    const timelineModeZoomAnchorRef = useRef(null);
    const timelinePanelRef = useRef(null);
    const wasCompactLayoutRef = useRef(false);
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
    const isCompactLayout = isCompactPlannerLayout(shellSize.width);
    const isShortViewport = isShortPlannerViewport(shellSize.height);
    const isEffectiveTaskListCollapsed = getEffectiveTaskListCollapsed(
        isTaskListCollapsed,
        isCompactTaskListCollapsed,
        isCompactLayout,
    );
    const plannerShellClassName = getPlannerShellClassName(isCompactLayout, isShortViewport);
    const taskListColumnWidth = getTaskListColumnWidth(
        taskListWidth,
        isEffectiveTaskListCollapsed,
        isCompactLayout,
        shellSize.width,
    );

    useLayoutEffect(function trackPlannerShellSize() {
        const shell = shellRef.current;

        if (!shell) {
            return undefined;
        }

        function updateShellSize() {
            shellResizeFrameIdRef.current = null;

            const shellRect = shell.getBoundingClientRect();
            const nextShellSize = {
                width: Math.round(shellRect.width),
                height: Math.round(shellRect.height),
            };

            setShellSize(function updateMeasuredShellSize(currentShellSize) {
                if (hasSameShellSize(currentShellSize, nextShellSize)) {
                    return currentShellSize;
                }

                return nextShellSize;
            });
        }

        function scheduleShellSizeUpdate() {
            if (shellResizeFrameIdRef.current !== null) {
                return;
            }

            shellResizeFrameIdRef.current = window.requestAnimationFrame(updateShellSize);
        }

        scheduleShellSizeUpdate();

        if (typeof ResizeObserver === "undefined") {
            window.addEventListener("resize", scheduleShellSizeUpdate);

            return function removeWindowResizeListener() {
                window.removeEventListener("resize", scheduleShellSizeUpdate);
                cancelShellResizeFrame(shellResizeFrameIdRef);
            };
        }

        const resizeObserver = new ResizeObserver(scheduleShellSizeUpdate);
        resizeObserver.observe(shell);

        return function disconnectResizeObserver() {
            resizeObserver.disconnect();
            cancelShellResizeFrame(shellResizeFrameIdRef);
        };
    }, []);

    useEffect(function collapseTaskListWhenCompactLayoutStarts() {
        if (isCompactLayout && !wasCompactLayoutRef.current) {
            setIsCompactTaskListCollapsed(true);
            taskListResizeStateRef.current = null;
            document.body.classList.remove("task-list-resizing");
            handleClearTaskHighlight();
        }

        wasCompactLayoutRef.current = isCompactLayout;
    }, [isCompactLayout]);

    useLayoutEffect(function alignModeZoomAnchor() {
        const panel = timelinePanelRef.current;
        const anchor = timelineModeZoomAnchorRef.current;

        if (!panel || !anchor) {
            return;
        }

        const metrics = getTimelineScaleMetrics(displayedTasks, zoomIndex, panel.clientWidth);
        const anchorOffset = getTimelineOffsetForDate(
            anchor.date,
            anchor.dayRatio,
            metrics.gridCells,
        );

        panel.scrollLeft = anchorOffset - anchor.viewportOffset;
        timelineModeZoomAnchorRef.current = null;
    }, [displayedTasks, zoomIndex]);

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
        if (isCompactLayout || isEffectiveTaskListCollapsed) {
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

        const metrics = getTimelineScaleMetrics(displayedTasks, zoomIndex, panel.clientWidth);
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

    function handleTimelineZoomModeChange(zoomMode) {
        const panel = timelinePanelRef.current;

        if (panel) {
            const metrics = getTimelineScaleMetrics(displayedTasks, zoomIndex, panel.clientWidth);

            timelineModeZoomAnchorRef.current = getPanelCenterAnchor(panel, metrics);
        }

        onTimelineZoomModeChange(zoomMode);
    }

    function handleTaskHighlight(taskId) {
        setHighlightedTaskId(taskId);
    }

    function handleClearTaskHighlight() {
        setHighlightedTaskId(null);
    }

    function handleTaskListCollapseToggle() {
        const nextIsTaskListCollapsed = !isEffectiveTaskListCollapsed;

        if (isCompactLayout) {
            setIsCompactTaskListCollapsed(nextIsTaskListCollapsed);
        } else {
            setIsTaskListCollapsed(nextIsTaskListCollapsed);
        }

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
        <Box ref={shellRef} className={plannerShellClassName}>
            <TaskToolbar
                hasSelectedTask={Boolean(selectedTaskId)}
                hasSelectedDayOffDates={selectedDayOffDates.length > 0}
                isTaskListCollapsed={isEffectiveTaskListCollapsed}
                canEditSelectedTask={canEditSelectedTask}
                canCopySelectedTasks={canCopySelectedTasks}
                canPasteCopiedTasks={canPasteCopiedTasks}
                canRedo={canRedo}
                canUndo={canUndo}
                isSaving={isSaving}
                zoomMode={zoomMode}
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
                onTimelineZoomModeChange={handleTimelineZoomModeChange}
                onTaskListCollapseToggle={handleTaskListCollapseToggle}
                onUndoTaskChange={onUndoTaskChange}
                selectedDatesHaveDayOff={selectedDatesHaveDayOff}
            />
            {isLoading && <LinearProgress className="planner-progress" />}
            <Box
                className={getPlannerContentClassName(isEffectiveTaskListCollapsed)}
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
                    isCollapsed={isEffectiveTaskListCollapsed}
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
                    showTimelineHorizontalGridLines={showTimelineHorizontalGridLines}
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
                tasks={selectedTasks}
                onClose={onDrawerClose}
                onCreateTask={onCreateTask}
                onSaveAssignees={onSaveAssignees}
                onUpdateTask={onUpdateTask}
                onUpdateTasks={onUpdateTasks}
            />
            <SettingsDrawer
                open={isSettingsDrawerOpen}
                colorMode={colorMode}
                showTimelineHorizontalGridLines={showTimelineHorizontalGridLines}
                onClose={onSettingsDrawerClose}
                onColorModeToggle={onColorModeToggle}
                onTimelineHorizontalGridLinesToggle={onTimelineHorizontalGridLinesToggle}
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


function getPanelCenterAnchor(panel, metrics) {
    const viewportOffset = panel.clientWidth / 2;
    const timelineOffset = panel.scrollLeft + viewportOffset;
    const timelineDate = getTimelineDateAtOffset(timelineOffset, metrics.gridCells);

    return {
        ...timelineDate,
        viewportOffset,
    };
}


function scrollTimelineTo(panel, scrollLeft) {
    const maxScrollLeft = Math.max(0, panel.scrollWidth - panel.clientWidth);
    const clampedScrollLeft = Math.min(Math.max(scrollLeft, 0), maxScrollLeft);

    panel.scrollTo({
        left: clampedScrollLeft,
        behavior: TIMELINE_SCROLL_BEHAVIOR,
    });
}


function getPlannerShellClassName(isCompactLayout, isShortViewport) {
    const classNames = ["planner-shell"];

    if (isCompactLayout) {
        classNames.push("planner-shell-compact");
    }

    if (isShortViewport) {
        classNames.push("planner-shell-short");
    }

    return classNames.join(" ");
}


function isCompactPlannerLayout(shellWidth) {
    return shellWidth > 0 && shellWidth < COMPACT_LAYOUT_MAX_WIDTH_PIXELS;
}


function isShortPlannerViewport(shellHeight) {
    return shellHeight > 0 && shellHeight < SHORT_VIEWPORT_MAX_HEIGHT_PIXELS;
}


function getEffectiveTaskListCollapsed(
    isTaskListCollapsed,
    isCompactTaskListCollapsed,
    isCompactLayout,
) {
    if (isCompactLayout) {
        return isCompactTaskListCollapsed;
    }

    return isTaskListCollapsed;
}


function hasSameShellSize(currentShellSize, nextShellSize) {
    return (
        currentShellSize.width === nextShellSize.width
        && currentShellSize.height === nextShellSize.height
    );
}


function cancelShellResizeFrame(shellResizeFrameIdRef) {
    if (shellResizeFrameIdRef.current === null) {
        return;
    }

    window.cancelAnimationFrame(shellResizeFrameIdRef.current);
    shellResizeFrameIdRef.current = null;
}


function getTaskListColumnWidth(
    taskListWidth,
    isTaskListCollapsed,
    isCompactLayout,
    shellWidth,
) {
    if (isTaskListCollapsed) {
        return 0;
    }

    if (isCompactLayout) {
        return getCompactTaskListWidth(shellWidth);
    }

    return getDesktopTaskListWidth(taskListWidth, shellWidth);
}


function getDesktopTaskListWidth(taskListWidth, shellWidth) {
    const clampedTaskListWidth = getClampedTaskListWidth(taskListWidth);

    if (shellWidth <= 0) {
        return clampedTaskListWidth;
    }

    const availableContentWidth = getAvailablePlannerContentWidth(shellWidth);
    const maximumResponsiveTaskListWidth = Math.max(
        MIN_TASK_LIST_WIDTH_PIXELS,
        Math.min(
            MAX_TASK_LIST_WIDTH_PIXELS,
            availableContentWidth - MIN_TIMELINE_WIDTH_PIXELS,
        ),
    );

    return Math.min(clampedTaskListWidth, maximumResponsiveTaskListWidth);
}


function getCompactTaskListWidth(shellWidth) {
    if (shellWidth <= 0) {
        return COMPACT_TASK_LIST_WIDTH_PIXELS;
    }

    const availableContentWidth = getAvailablePlannerContentWidth(shellWidth);
    const maximumCompactTaskListWidth = Math.max(
        COMPACT_MIN_TASK_LIST_WIDTH_PIXELS,
        availableContentWidth - COMPACT_MIN_TIMELINE_WIDTH_PIXELS,
    );

    return Math.min(COMPACT_TASK_LIST_WIDTH_PIXELS, maximumCompactTaskListWidth);
}


function getAvailablePlannerContentWidth(shellWidth) {
    return Math.max(0, shellWidth - TOOLBAR_PANEL_WIDTH_PIXELS);
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


function getInitialShellSize() {
    if (typeof window === "undefined") {
        return EMPTY_SHELL_SIZE;
    }

    return {
        width: window.innerWidth,
        height: window.innerHeight,
    };
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
