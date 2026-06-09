import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Box, LinearProgress } from "@mui/material";

import DayOffDrawer from "./DayOffDrawer";
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
import {
    TASK_LIST_COLUMNS,
    TASK_LIST_COLUMN_VISIBILITY_STORAGE_KEY,
    TASK_LIST_SORT_ASCENDING,
    TASK_LIST_SORT_DESCENDING,
    TASK_LIST_SORT_NONE,
    getDefaultTaskListColumnVisibility,
    getTaskListColumn,
    getTaskListColumnsMinimumWidth,
    getTaskListColumnValue,
} from "../utils/taskListColumns";


const TASK_LIST_WIDTH_STORAGE_KEY = "planner-task-list-width";
const DEFAULT_TASK_LIST_WIDTH_PIXELS = 360;
const MIN_TASK_LIST_WIDTH_PIXELS = 360;
const MAX_STORED_TASK_LIST_WIDTH_PIXELS = 1200;
const MAX_TASK_LIST_SCREEN_WIDTH_RATIO = 0.5;
const COMPACT_LAYOUT_MAX_WIDTH_PIXELS = 900;
const SHORT_VIEWPORT_MAX_HEIGHT_PIXELS = 560;
const TOOLBAR_PANEL_WIDTH_PIXELS = 56;
const COMPACT_TASK_LIST_WIDTH_PIXELS = 240;
const COMPACT_MIN_TASK_LIST_WIDTH_PIXELS = 180;
const COMPACT_MIN_TIMELINE_WIDTH_PIXELS = 240;
const DRAG_MOUSE_BUTTON = 0;
const SCROLL_SYNC_TOLERANCE_PIXELS = 1;
const TIMELINE_SCROLL_BEHAVIOR = "smooth";
const TASK_LIST_COLLATOR = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: "base",
});
const EMPTY_SHELL_SIZE = {
    width: 0,
    height: 0,
};
const EMPTY_TASK_LIST_SORT = {
    columnId: null,
    direction: TASK_LIST_SORT_NONE,
};


export default function PlannerShell(props) {
    const {
        tasks,
        dayOffs,
        assignees,
        projectNames,
        selectedTaskId,
        selectedTaskIds,
        selectedDayOffDates,
        selectedTask,
        selectedTasks,
        isDrawerOpen,
        isDayOffDrawerOpen,
        isLoading,
        isSaving,
        isAssigneeSaving,
        isProjectSaving,
        canRedo,
        canUndo,
        canEditSelectedTask,
        canCopySelectedTasks,
        canCutSelectedTasks,
        canPasteCopiedTasks,
        cutTaskIds,
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
        onSaveProjectNames,
        onColorModeToggle,
        onClearSelection,
        onCreateTask,
        onCopySelectedTasks,
        onCutSelectedTasks,
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
        onSelectTasks,
        onSelectDayOffDate,
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
    const [
        taskListColumnVisibility,
        setTaskListColumnVisibility,
    ] = useState(getInitialTaskListColumnVisibility);
    const [selectedTaskListFilters, setSelectedTaskListFilters] = useState({});
    const [taskListSort, setTaskListSort] = useState(EMPTY_TASK_LIST_SORT);
    const [highlightedTaskId, setHighlightedTaskId] = useState(null);
    const isSyncingScrollRef = useRef(false);
    const shellRef = useRef(null);
    const shellResizeFrameIdRef = useRef(null);
    const plannerContentRef = useRef(null);
    const taskListPanelRef = useRef(null);
    const taskListResizeFrameIdRef = useRef(null);
    const taskListResizeStateRef = useRef(null);
    const timelineModeZoomAnchorRef = useRef(null);
    const timelinePanelRef = useRef(null);
    const wasCompactLayoutRef = useRef(false);
    const timelineHeaderHeight = getTimelineHeaderHeight(zoomIndex);
    const visibleTaskListColumns = useMemo(function memoizeVisibleTaskListColumns() {
        return getVisibleTaskListColumns(taskListColumnVisibility);
    }, [taskListColumnVisibility]);
    const taskListFilterOptions = useMemo(function memoizeTaskListFilterOptions() {
        return getFilterOptionsByColumn(tasks, visibleTaskListColumns);
    }, [tasks, visibleTaskListColumns]);
    const displayedTasks = useMemo(function memoizeDisplayedTasks() {
        return getDisplayedTasks(tasks, selectedTaskListFilters, taskListSort);
    }, [tasks, selectedTaskListFilters, taskListSort]);
    const isTaskViewFilteredOrSorted = (
        hasActiveTaskListFilters(selectedTaskListFilters)
        || taskListSort.direction !== TASK_LIST_SORT_NONE
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
        function applyPendingTaskListWidth() {
            const resizeState = taskListResizeStateRef.current;

            taskListResizeFrameIdRef.current = null;

            if (!resizeState) {
                return;
            }

            applyTaskListContentWidth(plannerContentRef.current, resizeState.pendingWidth);
        }

        function scheduleTaskListWidthUpdate(nextWidth) {
            const resizeState = taskListResizeStateRef.current;

            resizeState.pendingWidth = nextWidth;

            if (taskListResizeFrameIdRef.current !== null) {
                return;
            }

            taskListResizeFrameIdRef.current = window.requestAnimationFrame(
                applyPendingTaskListWidth,
            );
        }

        function handleMouseMove(event) {
            const resizeState = taskListResizeStateRef.current;

            if (!resizeState) {
                return;
            }

            const widthDelta = event.clientX - resizeState.startClientX;
            const nextWidth = getClampedTaskListWidth(
                resizeState.startWidth + widthDelta,
                resizeState.maximumWidth,
            );

            resizeState.currentWidth = nextWidth;
            scheduleTaskListWidthUpdate(nextWidth);
        }

        function handleMouseUp() {
            const resizeState = taskListResizeStateRef.current;

            if (!resizeState) {
                return;
            }

            applyTaskListContentWidth(plannerContentRef.current, resizeState.currentWidth);
            setTaskListWidth(resizeState.currentWidth);
            saveTaskListWidth(resizeState.currentWidth);
            finishTaskListResize();
        }

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);

        return function removeTaskListResizeListeners() {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
            finishTaskListResize();
        };
    }, []);

    useEffect(function persistTaskListColumnVisibility() {
        saveTaskListColumnVisibility(taskListColumnVisibility);

        setSelectedTaskListFilters(function clearHiddenColumnFilters(currentFilters) {
            const nextFilters = Object.fromEntries(
                Object.entries(currentFilters).filter(function keepVisibleFilter([columnId]) {
                    return taskListColumnVisibility[columnId];
                }),
            );

            if (hasSameFilterState(currentFilters, nextFilters)) {
                return currentFilters;
            }

            return nextFilters;
        });

        setTaskListSort(function clearHiddenColumnSort(currentSort) {
            if (
                !currentSort.columnId
                || currentSort.direction === TASK_LIST_SORT_NONE
                || taskListColumnVisibility[currentSort.columnId]
            ) {
                return currentSort;
            }

            return EMPTY_TASK_LIST_SORT;
        });
    }, [taskListColumnVisibility]);

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
            startWidth: taskListColumnWidth,
            currentWidth: taskListColumnWidth,
            pendingWidth: taskListColumnWidth,
            maximumWidth: getMaximumDesktopTaskListWidth(shellSize.width),
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

    function handleTaskListFilterToggle(columnId, filterValue) {
        setSelectedTaskListFilters(function updateSelectedFilters(currentFilters) {
            const currentColumnFilters = currentFilters[columnId] || [];

            if (currentColumnFilters.includes(filterValue)) {
                const nextColumnFilters = currentColumnFilters.filter(function keepOtherFilter(
                    currentFilter,
                ) {
                    return currentFilter !== filterValue;
                });

                if (nextColumnFilters.length === 0) {
                    const {
                        [columnId]: _removedColumnFilters,
                        ...nextFilters
                    } = currentFilters;

                    return nextFilters;
                }

                return {
                    ...currentFilters,
                    [columnId]: nextColumnFilters,
                };
            }

            return {
                ...currentFilters,
                [columnId]: [...currentColumnFilters, filterValue],
            };
        });
    }

    function handleTaskListFiltersClear(columnId) {
        setSelectedTaskListFilters(function clearColumnFilters(currentFilters) {
            if (!currentFilters[columnId]) {
                return currentFilters;
            }

            const {
                [columnId]: _removedColumnFilters,
                ...nextFilters
            } = currentFilters;

            return nextFilters;
        });
    }

    function handleTaskListSortToggle(columnId) {
        setTaskListSort(function updateSort(currentSort) {
            return getNextTaskListSort(currentSort, columnId);
        });
    }

    function handleTaskListColumnVisibilityToggle(columnId) {
        const column = getTaskListColumn(columnId);

        if (!column || !column.canHide) {
            return;
        }

        const isColumnVisible = Boolean(taskListColumnVisibility[columnId]);
        const nextVisibility = {
            ...taskListColumnVisibility,
            [columnId]: !isColumnVisible,
        };
        const nextVisibleColumns = getVisibleTaskListColumns(nextVisibility);
        let resizeMode = "expand";

        if (isColumnVisible) {
            resizeMode = "fit";
        }

        updateTaskListWidthForColumns(nextVisibleColumns, resizeMode);

        setTaskListColumnVisibility(function updateColumnVisibility(currentVisibility) {
            return {
                ...currentVisibility,
                [columnId]: !currentVisibility[columnId],
            };
        });
    }

    function handleTaskListAutoResize() {
        finishTaskListResize();
        updateTaskListWidthForColumns(visibleTaskListColumns, "fit");
    }

    function finishTaskListResize() {
        cancelTaskListResizeFrame(taskListResizeFrameIdRef);
        taskListResizeStateRef.current = null;
        document.body.classList.remove("task-list-resizing");
    }

    function updateTaskListWidthForColumns(columns, resizeMode) {
        if (isCompactLayout) {
            return;
        }

        const requiredTaskListWidth = getTaskListColumnsMinimumWidth(columns);
        const maximumTaskListWidth = getMaximumDesktopTaskListWidth(shellSize.width);
        let targetTaskListWidth = requiredTaskListWidth;

        if (resizeMode === "expand") {
            targetTaskListWidth = Math.max(taskListWidth, requiredTaskListWidth);
        }

        const nextTaskListWidth = getClampedTaskListWidth(targetTaskListWidth, maximumTaskListWidth);

        applyTaskListContentWidth(plannerContentRef.current, nextTaskListWidth);

        if (nextTaskListWidth === taskListWidth) {
            return;
        }

        setTaskListWidth(nextTaskListWidth);
        saveTaskListWidth(nextTaskListWidth);
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
                canCutSelectedTasks={canCutSelectedTasks}
                canPasteCopiedTasks={canPasteCopiedTasks}
                canRedo={canRedo}
                canUndo={canUndo}
                isSaving={isSaving}
                colorMode={colorMode}
                showTimelineHorizontalGridLines={showTimelineHorizontalGridLines}
                zoomMode={zoomMode}
                onAddTaskClick={onAddTaskClick}
                onCopySelectedTasks={onCopySelectedTasks}
                onCutSelectedTasks={onCutSelectedTasks}
                onDayOffActionClick={onDayOffActionClick}
                onDeleteSelectedTask={onDeleteSelectedTask}
                onEditSelectedTask={onEditSelectedTask}
                onPasteCopiedTasks={onPasteCopiedTasks}
                onRefreshPlanner={onRefreshPlanner}
                onRedoTaskChange={onRedoTaskChange}
                onScrollTimelineFuture={handleScrollTimelineFuture}
                onScrollTimelinePast={handleScrollTimelinePast}
                onScrollTimelineToday={handleScrollTimelineToday}
                onTimelineZoomModeChange={handleTimelineZoomModeChange}
                onColorModeToggle={onColorModeToggle}
                onTimelineHorizontalGridLinesToggle={onTimelineHorizontalGridLinesToggle}
                onTaskListCollapseToggle={handleTaskListCollapseToggle}
                onUndoTaskChange={onUndoTaskChange}
                selectedDatesHaveDayOff={selectedDatesHaveDayOff}
            />
            {isLoading && <LinearProgress className="planner-progress" />}
            <Box
                ref={plannerContentRef}
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
                    columns={visibleTaskListColumns}
                    allColumns={TASK_LIST_COLUMNS}
                    columnVisibility={taskListColumnVisibility}
                    filterOptionsByColumn={taskListFilterOptions}
                    highlightedTaskId={taskListHighlightedTaskId}
                    isCollapsed={isEffectiveTaskListCollapsed}
                    selectedFiltersByColumn={selectedTaskListFilters}
                    selectedTaskIds={selectedTaskIds}
                    sortState={taskListSort}
                    headerHeight={timelineHeaderHeight}
                    onColumnVisibilityToggle={handleTaskListColumnVisibilityToggle}
                    onClearHighlight={handleClearTaskHighlight}
                    onClearSelection={onClearSelection}
                    onFilterToggle={handleTaskListFilterToggle}
                    onFiltersClear={handleTaskListFiltersClear}
                    onHighlightTask={handleTaskHighlight}
                    onPanelScroll={handleTaskListScroll}
                    onAutoResize={handleTaskListAutoResize}
                    onResizeStart={handleTaskListResizeStart}
                    onSelectTask={onSelectTask}
                    onSortToggle={handleTaskListSortToggle}
                />
                <TimelineChart
                    panelRef={timelinePanelRef}
                    tasks={displayedTasks}
                    dayOffs={dayOffs}
                    projectNames={projectNames}
                    cutTaskIds={cutTaskIds}
                    highlightedTaskId={timelineHighlightedTaskId}
                    isLoading={isLoading}
                    isRowReorderDisabled={isTaskViewFilteredOrSorted}
                    selectedDayOffDates={selectedDayOffDates}
                    selectedTaskIds={selectedTaskIds}
                    showTimelineHorizontalGridLines={showTimelineHorizontalGridLines}
                    zoomIndex={zoomIndex}
                    onClearHighlight={handleClearTaskHighlight}
                    onHighlightTask={handleTaskHighlight}
                    onMoveTasks={onMoveTasks}
                    onOpenTaskEdit={onOpenTaskEdit}
                    onOpenDayOffEdit={onOpenDayOffEdit}
                    onPanelScroll={handleTimelineScroll}
                    onResizeTaskDates={onResizeTaskDates}
                    onSelectTask={onSelectTask}
                    onSelectTasks={onSelectTasks}
                    onSelectDayOffDate={onSelectDayOffDate}
                    onTimelineZoom={onTimelineZoom}
                />
            </Box>
            <TaskDrawer
                open={isDrawerOpen}
                isSaving={isSaving}
                assignees={assignees}
                projectNames={projectNames}
                isAssigneeSaving={isAssigneeSaving}
                isProjectSaving={isProjectSaving}
                mode={drawerMode}
                task={selectedTask}
                tasks={selectedTasks}
                onClose={onDrawerClose}
                onCreateTask={onCreateTask}
                onSaveAssignees={onSaveAssignees}
                onSaveProjectNames={onSaveProjectNames}
                onUpdateTask={onUpdateTask}
                onUpdateTasks={onUpdateTasks}
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


function cancelTaskListResizeFrame(taskListResizeFrameIdRef) {
    if (taskListResizeFrameIdRef.current === null) {
        return;
    }

    window.cancelAnimationFrame(taskListResizeFrameIdRef.current);
    taskListResizeFrameIdRef.current = null;
}


function applyTaskListContentWidth(plannerContent, taskListWidth) {
    if (!plannerContent) {
        return;
    }

    plannerContent.style.gridTemplateColumns = `${taskListWidth}px minmax(0, 1fr)`;
    plannerContent.style.setProperty("--planner-task-list-boundary", `${taskListWidth}px`);
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
    const clampedTaskListWidth = getClampedTaskListWidth(
        taskListWidth,
        getMaximumDesktopTaskListWidth(shellWidth),
    );

    if (shellWidth <= 0) {
        return clampedTaskListWidth;
    }

    const availableContentWidth = getAvailablePlannerContentWidth(shellWidth);
    const maximumResponsiveTaskListWidth = Math.max(
        MIN_TASK_LIST_WIDTH_PIXELS,
        Math.min(getMaximumDesktopTaskListWidth(shellWidth), availableContentWidth),
    );

    return Math.min(clampedTaskListWidth, maximumResponsiveTaskListWidth);
}


function getMaximumDesktopTaskListWidth(shellWidth) {
    if (shellWidth <= 0) {
        return MAX_STORED_TASK_LIST_WIDTH_PIXELS;
    }

    const halfScreenWidth = Math.floor(shellWidth * MAX_TASK_LIST_SCREEN_WIDTH_RATIO);

    return Math.max(MIN_TASK_LIST_WIDTH_PIXELS, halfScreenWidth);
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


function getFilterOptionsByColumn(tasks, visibleColumns) {
    return visibleColumns.reduce(function mapColumnFilterOptions(filterOptions, column) {
        if (!column.canFilter) {
            return filterOptions;
        }

        const columnValues = tasks.map(function mapTaskColumnValue(task) {
            return String(getTaskListColumnValue(task, column.id));
        });
        const uniqueColumnValues = Array.from(new Set(columnValues));

        filterOptions[column.id] = uniqueColumnValues.sort(compareTextValues);

        return filterOptions;
    }, {});
}


function getDisplayedTasks(tasks, selectedFiltersByColumn, sortState) {
    const indexedTasks = tasks.map(function mapIndexedTask(task, index) {
        return {
            index,
            task,
        };
    });
    const filteredTasks = getFilteredIndexedTasks(indexedTasks, selectedFiltersByColumn);

    if (!sortState.columnId || sortState.direction === TASK_LIST_SORT_NONE) {
        return filteredTasks.map(function mapFilteredTask(indexedTask) {
            return indexedTask.task;
        });
    }

    const sortedTasks = [...filteredTasks].sort(function compareIndexedTasks(first, second) {
        return compareIndexedTasksBySort(first, second, sortState);
    });

    return sortedTasks.map(function mapSortedTask(indexedTask) {
        return indexedTask.task;
    });
}


function getFilteredIndexedTasks(indexedTasks, selectedFiltersByColumn) {
    const activeFilters = Object.entries(selectedFiltersByColumn).filter(function hasFilters(
        [_columnId, filterValues],
    ) {
        return filterValues.length > 0;
    });

    if (activeFilters.length === 0) {
        return indexedTasks;
    }

    return indexedTasks.filter(function matchSelectedFilters(indexedTask) {
        return activeFilters.every(function matchColumnFilter([columnId, filterValues]) {
            const selectedValues = new Set(filterValues);
            const taskValue = String(getTaskListColumnValue(indexedTask.task, columnId));

            return selectedValues.has(taskValue);
        });
    });
}


function compareIndexedTasksBySort(first, second, sortState) {
    const column = getTaskListColumn(sortState.columnId);

    if (!column) {
        return first.index - second.index;
    }

    const firstValue = getTaskListColumnValue(first.task, column.id);
    const secondValue = getTaskListColumnValue(second.task, column.id);
    const valueComparison = compareTaskListValues(firstValue, secondValue, column.sortType);

    if (valueComparison === 0) {
        return first.index - second.index;
    }

    if (sortState.direction === TASK_LIST_SORT_DESCENDING) {
        return -valueComparison;
    }

    return valueComparison;
}


function compareTaskListValues(firstValue, secondValue, sortType) {
    if (sortType === "number") {
        return Number(firstValue) - Number(secondValue);
    }

    if (sortType === "date") {
        return compareDateValues(firstValue, secondValue);
    }

    return compareTextValues(String(firstValue), String(secondValue));
}


function compareDateValues(firstValue, secondValue) {
    const firstTime = Date.parse(firstValue);
    const secondTime = Date.parse(secondValue);

    if (Number.isNaN(firstTime) && Number.isNaN(secondTime)) {
        return compareTextValues(String(firstValue), String(secondValue));
    }

    if (Number.isNaN(firstTime)) {
        return -1;
    }

    if (Number.isNaN(secondTime)) {
        return 1;
    }

    return firstTime - secondTime;
}


function compareTextValues(firstValue, secondValue) {
    return TASK_LIST_COLLATOR.compare(firstValue, secondValue);
}


function getNextTaskListSort(currentSort, columnId) {
    if (currentSort.columnId !== columnId) {
        return {
            columnId,
            direction: TASK_LIST_SORT_ASCENDING,
        };
    }

    if (currentSort.direction === TASK_LIST_SORT_NONE) {
        return {
            columnId,
            direction: TASK_LIST_SORT_ASCENDING,
        };
    }

    if (currentSort.direction === TASK_LIST_SORT_ASCENDING) {
        return {
            columnId,
            direction: TASK_LIST_SORT_DESCENDING,
        };
    }

    return EMPTY_TASK_LIST_SORT;
}


function getVisibleTaskListColumns(taskListColumnVisibility) {
    return TASK_LIST_COLUMNS.filter(function isColumnVisible(column) {
        if (!column.canHide) {
            return true;
        }

        return Boolean(taskListColumnVisibility[column.id]);
    });
}


function hasActiveTaskListFilters(selectedFiltersByColumn) {
    return Object.values(selectedFiltersByColumn).some(function hasFilterValues(filterValues) {
        return filterValues.length > 0;
    });
}


function hasSameFilterState(firstFilters, secondFilters) {
    return JSON.stringify(firstFilters) === JSON.stringify(secondFilters);
}


function getInitialTaskListColumnVisibility() {
    const storedColumnVisibility = readStoredTaskListColumnVisibility();

    if (storedColumnVisibility) {
        return storedColumnVisibility;
    }

    return getDefaultTaskListColumnVisibility();
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


function readStoredTaskListColumnVisibility() {
    try {
        const storedValue = window.localStorage.getItem(TASK_LIST_COLUMN_VISIBILITY_STORAGE_KEY);

        if (!storedValue) {
            return null;
        }

        const parsedValue = JSON.parse(storedValue);

        return normalizeStoredTaskListColumnVisibility(parsedValue);
    } catch {
        return null;
    }
}


function normalizeStoredTaskListColumnVisibility(storedVisibility) {
    if (!storedVisibility || typeof storedVisibility !== "object") {
        return null;
    }

    const defaultVisibility = getDefaultTaskListColumnVisibility();
    const normalizedVisibility = {
        ...defaultVisibility,
    };

    TASK_LIST_COLUMNS.forEach(function normalizeColumnVisibility(column) {
        if (!column.canHide) {
            normalizedVisibility[column.id] = true;
            return;
        }

        if (typeof storedVisibility[column.id] === "boolean") {
            normalizedVisibility[column.id] = storedVisibility[column.id];
        }
    });

    return normalizedVisibility;
}


function saveTaskListWidth(taskListWidth) {
    try {
        window.localStorage.setItem(TASK_LIST_WIDTH_STORAGE_KEY, String(taskListWidth));
    } catch {
        return;
    }
}


function saveTaskListColumnVisibility(taskListColumnVisibility) {
    try {
        window.localStorage.setItem(
            TASK_LIST_COLUMN_VISIBILITY_STORAGE_KEY,
            JSON.stringify(taskListColumnVisibility),
        );
    } catch {
        return;
    }
}


function getClampedTaskListWidth(
    taskListWidth,
    maximumTaskListWidth = MAX_STORED_TASK_LIST_WIDTH_PIXELS,
) {
    return Math.min(
        Math.max(taskListWidth, MIN_TASK_LIST_WIDTH_PIXELS),
        maximumTaskListWidth,
    );
}
