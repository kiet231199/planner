import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Box, Typography } from "@mui/material";

import {
    getDateDeltaDays,
    getDurationDays,
    getTimelineDateAtOffset,
    getTimelineMetrics,
    getTimelineOffsetForDate,
} from "../utils/chartScale";


const DRAG_MOUSE_BUTTON = 0;
const MIN_RESIZE_PREVIEW_WIDTH_PIXELS = 28;
const MIN_TIMELINE_HEADER_ROW_COUNT = 1;
const START_RESIZE_EDGE = "start";
const STOP_RESIZE_EDGE = "stop";
const TASK_DRAG_THRESHOLD_PIXELS = 4;
const TASK_DRAG_TYPE_MOVE = "task-move";
const TASK_DRAG_TYPE_RESIZE = "task-resize";
const TODAY_HIGHLIGHT_MODE_COLUMN = "column";
const TODAY_HIGHLIGHT_MODE_LINE = "line";
const TASK_HOVER_BUBBLE_OFFSET_Y_PIXELS = 14;
const DAY_HEADER_MODE = "day";
const WEEK_HEADER_MODE = "week";
const SUNDAY_DAY_INDEX = 0;
const SATURDAY_DAY_INDEX = 6;
const ZOOM_IN_DIRECTION = 10;
const ZOOM_OUT_DIRECTION = -10;


export default function TimelineChart(props) {
    const {
        tasks,
        isLoading,
        selectedTaskIds,
        zoomIndex,
        onClearSelection,
        onMoveTasks,
        onOpenTaskEdit,
        onResizeTaskDates,
        onSelectTask,
        onTimelineZoom,
    } = props;

    const panelRef = useRef(null);
    const dragStateRef = useRef(null);
    const didSetInitialScrollRef = useRef(false);
    const metricsRef = useRef(null);
    const onMoveTasksRef = useRef(onMoveTasks);
    const onResizeTaskDatesRef = useRef(onResizeTaskDates);
    const onSelectTaskRef = useRef(onSelectTask);
    const onTimelineZoomRef = useRef(onTimelineZoom);
    const pendingZoomAnchorRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    const [panelWidth, setPanelWidth] = useState(0);
    const [taskDragPreview, setTaskDragPreview] = useState(null);
    const [taskHoverBubble, setTaskHoverBubble] = useState(null);

    const metrics = getTimelineMetrics(tasks, zoomIndex, panelWidth);
    const chartHeight = metrics.headerHeight + Math.max(tasks.length, 1) * metrics.rowHeight;
    const headerRowHeight = getTimelineHeaderRowHeight(metrics.headerHeight, metrics.headerRows);
    metricsRef.current = metrics;

    useEffect(function keepTimelineZoomHandlerCurrent() {
        onTimelineZoomRef.current = onTimelineZoom;
    }, [onTimelineZoom]);

    useEffect(function keepTaskDragHandlersCurrent() {
        onMoveTasksRef.current = onMoveTasks;
        onResizeTaskDatesRef.current = onResizeTaskDates;
        onSelectTaskRef.current = onSelectTask;
    }, [onMoveTasks, onResizeTaskDates, onSelectTask]);

    useLayoutEffect(function trackTimelinePanelWidth() {
        const panel = panelRef.current;

        if (!panel) {
            return undefined;
        }

        function updatePanelWidth() {
            setPanelWidth(panel.clientWidth);
        }

        updatePanelWidth();

        if (typeof ResizeObserver === "undefined") {
            window.addEventListener("resize", updatePanelWidth);

            return function removeWindowResizeListener() {
                window.removeEventListener("resize", updatePanelWidth);
            };
        }

        const resizeObserver = new ResizeObserver(updatePanelWidth);
        resizeObserver.observe(panel);

        return function disconnectResizeObserver() {
            resizeObserver.disconnect();
        };
    }, []);

    useLayoutEffect(function alignScrollWithTimelineScale() {
        const panel = panelRef.current;

        if (!panel) {
            return;
        }

        if (isLoading) {
            return;
        }

        if (!didSetInitialScrollRef.current) {
            panel.scrollLeft = getCenteredTodayScrollLeft(panel, metrics);
            didSetInitialScrollRef.current = true;
            return;
        }

        if (pendingZoomAnchorRef.current) {
            const anchor = pendingZoomAnchorRef.current;
            const anchorOffset = getTimelineOffsetForDate(
                anchor.date,
                anchor.dayRatio,
                metrics.gridCells,
            );
            panel.scrollLeft = anchorOffset - anchor.viewportOffset;
            pendingZoomAnchorRef.current = null;
            return;
        }
    }, [isLoading, metrics]);

    useEffect(function bindDragListeners() {
        function handleMouseMove(event) {
            if (!dragStateRef.current) {
                return;
            }

            if (isTaskInteractionDrag(dragStateRef.current)) {
                updateTaskDragPreview(dragStateRef.current, event);
                return;
            }

            const panel = dragStateRef.current.panel;
            const dragDistance = event.clientX - dragStateRef.current.startClientX;
            panel.scrollLeft = dragStateRef.current.startScrollLeft - dragDistance;
        }

        function handleMouseUp(event) {
            if (dragStateRef.current && isTaskInteractionDrag(dragStateRef.current)) {
                finishTaskDrag(dragStateRef.current, event);
                return;
            }

            dragStateRef.current = null;
            setIsDragging(false);
        }

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);

        return function removeDragListeners() {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, []);

    useEffect(function bindWheelListener() {
        const panel = panelRef.current;

        if (!panel) {
            return undefined;
        }

        function handleTimelineWheel(event) {
            if (event.ctrlKey) {
                event.preventDefault();
                pendingZoomAnchorRef.current = getZoomAnchor(
                    panel,
                    event,
                    metricsRef.current.gridCells,
                );
                onTimelineZoomRef.current(getWheelZoomDirection(event));
                return;
            }

            if (event.shiftKey || event.deltaX !== 0) {
                event.preventDefault();
                scrollTimelineVertically(panel, event.deltaY);
            }
        }

        panel.addEventListener("wheel", handleTimelineWheel, {
            passive: false,
        });

        return function removeWheelListener() {
            panel.removeEventListener("wheel", handleTimelineWheel);
        };
    }, []);

    function handleTimelineMouseDown(event) {
        if (event.button !== DRAG_MOUSE_BUTTON) {
            return;
        }

        if (event.target instanceof Element && event.target.closest(".task-bar")) {
            return;
        }

        onClearSelection();

        const panel = panelRef.current;

        if (!panel) {
            return;
        }

        event.preventDefault();

        dragStateRef.current = {
            panel,
            startClientX: event.clientX,
            startScrollLeft: panel.scrollLeft,
        };
        setIsDragging(true);
    }

    function handleTaskBarMouseDown(event, task) {
        if (event.button !== DRAG_MOUSE_BUTTON) {
            return;
        }

        const panel = panelRef.current;

        if (!panel) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        setTaskHoverBubble(null);

        if (event.ctrlKey || event.metaKey) {
            onSelectTask(task.id, true);
            return;
        }

        const taskIds = getTaskInteractionIds(tasks, selectedTaskIds, task.id);

        if (!selectedTaskIds.includes(task.id)) {
            onSelectTask(task.id, false);
        }

        dragStateRef.current = {
            type: TASK_DRAG_TYPE_MOVE,
            taskId: task.id,
            taskIds,
            panel,
            gridCells: metricsRef.current.gridCells,
            startClientX: event.clientX,
            startClientY: event.clientY,
            startTimelineDate: getTimelineDateAtPointer(panel, event, metricsRef.current.gridCells),
            rowHeight: metricsRef.current.rowHeight,
            hasMoved: false,
            dayDelta: 0,
            pixelDelta: 0,
            pixelDeltaY: 0,
        };
    }

    function handleTaskBarMouseMove(event, task) {
        setTaskHoverBubble({
            task,
            x: event.clientX,
            y: event.clientY + TASK_HOVER_BUBBLE_OFFSET_Y_PIXELS,
        });
    }

    function handleTaskBarMouseLeave() {
        setTaskHoverBubble(null);
    }

    function handleTaskResizeMouseDown(event, task, resizeEdge) {
        if (event.button !== DRAG_MOUSE_BUTTON) {
            return;
        }

        const panel = panelRef.current;

        if (!panel) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        setTaskHoverBubble(null);

        if (selectedTaskIds.length > 1) {
            return;
        }

        onSelectTask(task.id, false);

        dragStateRef.current = {
            type: TASK_DRAG_TYPE_RESIZE,
            resizeEdge,
            taskId: task.id,
            taskIds: [task.id],
            panel,
            gridCells: metricsRef.current.gridCells,
            startClientX: event.clientX,
            startClientY: event.clientY,
            startTimelineDate: getTimelineDateAtPointer(panel, event, metricsRef.current.gridCells),
            rowHeight: metricsRef.current.rowHeight,
            hasMoved: false,
            dayDelta: 0,
            pixelDelta: 0,
            pixelDeltaY: 0,
        };
    }

    function updateTaskDragPreview(dragState, event) {
        const movement = getPointerMovement(dragState, event);

        if (!dragState.hasMoved && movement < TASK_DRAG_THRESHOLD_PIXELS) {
            return;
        }

        dragState.hasMoved = true;
        setTaskHoverBubble(null);
        dragState.dayDelta = getTaskDragDayDelta(dragState, event);
        dragState.pixelDelta = event.clientX - dragState.startClientX;
        dragState.pixelDeltaY = event.clientY - dragState.startClientY;

        setTaskDragPreview({
            taskId: dragState.taskId,
            taskIds: dragState.taskIds,
            type: dragState.type,
            resizeEdge: dragState.resizeEdge,
            pixelDelta: dragState.pixelDelta,
            pixelDeltaY: dragState.pixelDeltaY,
        });
    }

    function finishTaskDrag(dragState, event) {
        dragStateRef.current = null;
        setTaskDragPreview(null);

        if (!dragState.hasMoved) {
            onSelectTaskRef.current(dragState.taskId);
            return;
        }

        const dayDelta = getTaskDragDayDelta(dragState, event);
        const rowDelta = getTaskDragRowDelta(dragState, event);

        if (dragState.type === TASK_DRAG_TYPE_RESIZE && dayDelta !== 0) {
            onResizeTaskDatesRef.current(dragState.taskId, dragState.resizeEdge, dayDelta);
            return;
        }

        if (dragState.type === TASK_DRAG_TYPE_MOVE && (dayDelta !== 0 || rowDelta !== 0)) {
            onMoveTasksRef.current(dragState.taskId, dayDelta, rowDelta);
        }
    }

    return (
        <Box
            ref={panelRef}
            className={isDragging ? "timeline-panel timeline-panel-dragging" : "timeline-panel"}
            onMouseDown={handleTimelineMouseDown}
        >
            <Box
                className="timeline-canvas"
                sx={{
                    width: `${metrics.timelineWidth}px`,
                    minHeight: `max(100%, ${chartHeight}px)`,
                }}
            >
                <Box className="timeline-header" sx={{ height: `${metrics.headerHeight}px` }}>
                    {metrics.headerRows.map(function renderHeaderRow(headerRow, rowIndex) {
                        return (
                            <Box
                                key={rowIndex}
                                className="timeline-header-row"
                                sx={{ height: `${headerRowHeight}px` }}
                            >
                                {headerRow.map(function renderHeaderCell(segment) {
                                    return (
                                        <Box
                                            key={segment.key}
                                            className="timeline-header-cell"
                                            sx={{ width: `${segment.width}px` }}
                                        >
                                            {segment.label}
                                        </Box>
                                    );
                                })}
                            </Box>
                        );
                    })}
                </Box>
                <Box
                    className="timeline-grid"
                    sx={{
                        top: `${metrics.headerHeight}px`,
                        bottom: 0,
                    }}
                >
                    {metrics.gridCells.map(function renderGridCell(cell) {
                        const weekendShadowSegments = getWeekendShadowSegments(metrics, cell);
                        const todayHighlight = getTodayHighlight(metrics, cell);

                        return (
                            <Box
                                key={cell.key}
                                className="timeline-grid-column"
                                sx={{ width: `${cell.width}px` }}
                            >
                                {weekendShadowSegments.map(function renderWeekendShadowSegment(
                                    segment,
                                ) {
                                    return (
                                        <Box
                                            key={segment.key}
                                            className="timeline-weekend-shadow-segment"
                                            sx={{
                                                left: `${segment.left}px`,
                                                width: `${segment.width}px`,
                                            }}
                                        />
                                    );
                                })}
                                {todayHighlight && (
                                    <Box
                                        className={getTodayHighlightClassName(todayHighlight)}
                                        sx={getTodayHighlightStyle(todayHighlight)}
                                    />
                                )}
                            </Box>
                        );
                    })}
                </Box>
                <Box
                    className="timeline-rows"
                    sx={{
                        top: `${metrics.headerHeight}px`,
                    }}
                />
                <Box
                    className="timeline-bars"
                    sx={{
                        top: `${metrics.headerHeight}px`,
                    }}
                >
                    {metrics.bars.map(function renderTaskBar(bar) {
                        const isSelected = selectedTaskIds.includes(bar.task.id);
                        const canResizeTask = selectedTaskIds.length <= 1;
                        const taskBarLayout = getTaskBarLayout(bar, taskDragPreview);

                        return (
                            <Box
                                key={bar.task.id}
                                role="button"
                                tabIndex={0}
                                className={isSelected ? "task-bar task-bar-selected" : "task-bar"}
                                sx={{
                                    left: `${taskBarLayout.left}px`,
                                    top: `${taskBarLayout.top + 6}px`,
                                    width: `${taskBarLayout.width}px`,
                                    backgroundColor: getTaskColor(bar.task),
                                }}
                                onDoubleClick={function openTaskEdit(event) {
                                    event.stopPropagation();
                                    onOpenTaskEdit(bar.task.id);
                                }}
                                onMouseDown={function startTaskDrag(event) {
                                    handleTaskBarMouseDown(event, bar.task);
                                }}
                                onMouseEnter={function showTaskHoverBubble(event) {
                                    handleTaskBarMouseMove(event, bar.task);
                                }}
                                onMouseMove={function moveTaskHoverBubble(event) {
                                    handleTaskBarMouseMove(event, bar.task);
                                }}
                                onMouseLeave={handleTaskBarMouseLeave}
                                onKeyDown={function handleTaskBarKeyDown(event) {
                                    if (event.key === "Enter" || event.key === " ") {
                                        onSelectTask(bar.task.id, event.ctrlKey || event.metaKey);
                                    }
                                }}
                            >
                                {canResizeTask && (
                                    <Box
                                        className="task-bar-resize-handle task-bar-resize-handle-left"
                                        onMouseDown={function startTaskStartResize(event) {
                                            handleTaskResizeMouseDown(
                                                event,
                                                bar.task,
                                                START_RESIZE_EDGE,
                                            );
                                        }}
                                    />
                                )}
                                <Box
                                    className="task-bar-progress"
                                    sx={{
                                        width: `${bar.task.progressPercent}%`,
                                    }}
                                />
                                <Typography className="task-bar-label">
                                    {bar.task.name}
                                </Typography>
                                {canResizeTask && (
                                    <Box
                                        className="task-bar-resize-handle task-bar-resize-handle-right"
                                        onMouseDown={function startTaskStopResize(event) {
                                            handleTaskResizeMouseDown(
                                                event,
                                                bar.task,
                                                STOP_RESIZE_EDGE,
                                            );
                                        }}
                                    />
                                )}
                            </Box>
                        );
                    })}
                    {taskHoverBubble && (
                        <Box
                            className="task-hover-bubble"
                            sx={{
                                left: `${taskHoverBubble.x}px`,
                                top: `${taskHoverBubble.y}px`,
                            }}
                        >
                            <Typography className="task-hover-bubble-title">
                                {taskHoverBubble.task.name}
                            </Typography>
                            <Box className="task-hover-bubble-grid">
                                <Typography className="task-hover-bubble-label">
                                    Assignee
                                </Typography>
                                <Typography className="task-hover-bubble-value">
                                    {getAssigneeLabel(taskHoverBubble.task)}
                                </Typography>
                                <Typography className="task-hover-bubble-label">
                                    Progress
                                </Typography>
                                <Typography className="task-hover-bubble-value">
                                    {getProgressLabel(taskHoverBubble.task)}
                                </Typography>
                                <Typography className="task-hover-bubble-label">
                                    Duration
                                </Typography>
                                <Typography className="task-hover-bubble-value">
                                    {getDurationLabel(taskHoverBubble.task)}
                                </Typography>
                            </Box>
                        </Box>
                    )}
                </Box>
            </Box>
        </Box>
    );
}


function getAssigneeLabel(task) {
    return task.assignee || "Unassigned";
}


function getProgressLabel(task) {
    return `${task.progressPercent}%`;
}


function getDurationLabel(task) {
    const durationDays = getDurationDays(task);

    if (durationDays === 1) {
        return "1 day";
    }

    return `${durationDays} days`;
}


function getTodayHighlight(metrics, cell) {
    if (!isDateInCell(metrics.todayDate, cell)) {
        return null;
    }

    const dayWidth = cell.width / cell.dayCount;
    const dayOffset = getDateDeltaDays(cell.startDate, metrics.todayDate);
    const dayLeft = dayOffset * dayWidth;

    if (shouldShowTodayColumn(metrics)) {
        return {
            mode: TODAY_HIGHLIGHT_MODE_COLUMN,
            left: dayLeft,
            width: dayWidth,
        };
    }

    return {
        mode: TODAY_HIGHLIGHT_MODE_LINE,
        left: dayLeft + dayWidth / 2,
    };
}


function shouldShowTodayColumn(metrics) {
    return metrics.headerMode === DAY_HEADER_MODE || metrics.headerMode === WEEK_HEADER_MODE;
}


function getTodayHighlightClassName(todayHighlight) {
    if (todayHighlight.mode === TODAY_HIGHLIGHT_MODE_COLUMN) {
        return "timeline-today-highlight-column";
    }

    return "timeline-today-highlight-line";
}


function getTodayHighlightStyle(todayHighlight) {
    const todayHighlightStyle = {
        left: `${todayHighlight.left}px`,
    };

    if (todayHighlight.width) {
        todayHighlightStyle.width = `${todayHighlight.width}px`;
    }

    return todayHighlightStyle;
}


function isDateInCell(date, cell) {
    return date >= cell.startDate && date <= cell.stopDate;
}


function getWeekendShadowSegments(metrics, cell) {
    if (!shouldShowWeekendShadows(metrics)) {
        return [];
    }

    const dayWidth = cell.width / cell.dayCount;
    const weekendShadowSegments = [];

    for (let dayOffset = 0; dayOffset < cell.dayCount; dayOffset += 1) {
        const date = addDays(cell.startDate, dayOffset);

        if (!isWeekendDate(date)) {
            continue;
        }

        weekendShadowSegments.push({
            key: `${cell.key}-${dayOffset}`,
            left: dayOffset * dayWidth,
            width: dayWidth,
        });
    }

    return weekendShadowSegments;
}


function shouldShowWeekendShadows(metrics) {
    return metrics.headerMode === DAY_HEADER_MODE || metrics.headerMode === WEEK_HEADER_MODE;
}


function isWeekendDate(date) {
    const dayIndex = date.getDay();

    return dayIndex === SUNDAY_DAY_INDEX || dayIndex === SATURDAY_DAY_INDEX;
}


function addDays(date, daysToAdd) {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + daysToAdd);

    return nextDate;
}


function getTimelineHeaderRowHeight(headerHeight, headerRows) {
    const headerRowCount = Math.max(headerRows.length, MIN_TIMELINE_HEADER_ROW_COUNT);

    return headerHeight / headerRowCount;
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


function getPointerMovement(dragState, event) {
    return Math.max(
        Math.abs(event.clientX - dragState.startClientX),
        Math.abs(event.clientY - dragState.startClientY),
    );
}


function isTaskInteractionDrag(dragState) {
    return dragState.type === TASK_DRAG_TYPE_MOVE || dragState.type === TASK_DRAG_TYPE_RESIZE;
}


function getTaskInteractionIds(tasks, selectedTaskIds, taskId) {
    if (!selectedTaskIds.includes(taskId)) {
        return [taskId];
    }

    return tasks
        .filter(function matchSelectedTask(task) {
            return selectedTaskIds.includes(task.id);
        })
        .map(function mapTaskId(task) {
            return task.id;
        });
}


function getTimelineDateAtPointer(panel, event, gridCells) {
    const panelRect = panel.getBoundingClientRect();
    const viewportOffset = event.clientX - panelRect.left;
    const timelineOffset = panel.scrollLeft + viewportOffset;

    return getTimelineDateAtOffset(timelineOffset, gridCells).date;
}


function getTaskDragDayDelta(dragState, event) {
    const currentDate = getTimelineDateAtPointer(
        dragState.panel,
        event,
        dragState.gridCells,
    );

    return getDateDeltaDays(dragState.startTimelineDate, currentDate);
}


function getTaskDragRowDelta(dragState, event) {
    return Math.round((event.clientY - dragState.startClientY) / dragState.rowHeight);
}


function getZoomAnchor(panel, event, gridCells) {
    const panelRect = panel.getBoundingClientRect();
    const viewportOffset = event.clientX - panelRect.left;
    const timelineOffset = panel.scrollLeft + viewportOffset;
    const timelineDate = getTimelineDateAtOffset(timelineOffset, gridCells);

    return {
        ...timelineDate,
        viewportOffset,
    };
}


function getTaskBarLayout(bar, taskDragPreview) {
    if (!taskDragPreview || !taskDragPreview.taskIds.includes(bar.task.id)) {
        return {
            left: bar.left,
            top: bar.top,
            width: bar.width,
        };
    }

    if (taskDragPreview.type === TASK_DRAG_TYPE_RESIZE) {
        return getResizePreviewLayout(bar, taskDragPreview);
    }

    return {
        left: bar.left + taskDragPreview.pixelDelta,
        top: bar.top + taskDragPreview.pixelDeltaY,
        width: bar.width,
    };
}


function getResizePreviewLayout(bar, taskDragPreview) {
    if (taskDragPreview.resizeEdge === START_RESIZE_EDGE) {
        const pixelDelta = Math.min(
            taskDragPreview.pixelDelta,
            bar.width - MIN_RESIZE_PREVIEW_WIDTH_PIXELS,
        );

        return {
            left: bar.left + pixelDelta,
            top: bar.top,
            width: bar.width - pixelDelta,
        };
    }

    const pixelDelta = Math.max(
        taskDragPreview.pixelDelta,
        MIN_RESIZE_PREVIEW_WIDTH_PIXELS - bar.width,
    );

    return {
        left: bar.left,
        top: bar.top,
        width: bar.width + pixelDelta,
    };
}


function getWheelZoomDirection(event) {
    if (event.deltaY > 0) {
        return ZOOM_OUT_DIRECTION;
    }

    return ZOOM_IN_DIRECTION;
}


function getTaskColor(task) {
    return getColorFromTaskType(task.taskType);
}


function scrollTimelineVertically(panel, deltaY) {
    if (deltaY === 0) {
        return;
    }

    panel.scrollTop += deltaY;
}


function getColorFromTaskType(taskType) {
    const colors = {
        Planning: "#00a896",
        Design: "#7c4dff",
        Development: "#1976d2",
        Testing: "#ef6c00",
        Release: "#c2185b",
    };

    return colors[taskType] || "#1976d2";
}
