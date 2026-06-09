import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Box, Typography } from "@mui/material";

import {
    getDateDeltaDays,
    getDurationDays,
    getTimelineBodyRowCount,
    getTimelineDateAtOffset,
    getTimelineOffsetForDate,
    getTimelineScaleMetrics,
    getTimelineTaskBars,
} from "../utils/chartScale";
import {
    DAY_OFF_ALL_ASSIGNEES,
    DEFAULT_TASK_TYPE_COLOR,
    NO_PROJECT_NAME,
    RELEASE_TASK_TYPE,
    TASK_TYPE_COLORS,
} from "../constants/taskOptions";


const LEFT_MOUSE_BUTTON = 0;
const RIGHT_MOUSE_BUTTON = 2;
const MIN_RESIZE_PREVIEW_WIDTH_PIXELS = 28;
const MIN_TIMELINE_HEADER_ROW_COUNT = 1;
const TIMELINE_GRID_LINE_WIDTH_PIXELS = 1;
const TIMELINE_TODAY_LINE_WIDTH_PIXELS = 2;
const TIMELINE_PAN_MOVED_THRESHOLD_PIXELS = 1;
const TIMELINE_HEADER_OVERSCAN_PIXELS = 720;
const TIMELINE_VISIBLE_RANGE_STEP_PIXELS = 240;
const START_RESIZE_EDGE = "start";
const STOP_RESIZE_EDGE = "stop";
const TASK_DRAG_THRESHOLD_PIXELS = 4;
const TASK_DRAG_TYPE_MOVE = "task-move";
const TASK_DRAG_TYPE_RESIZE = "task-resize";
const TIMELINE_DRAG_TYPE_PAN = "timeline-pan";
const TIMELINE_DRAG_TYPE_RECTANGLE_SELECT = "rectangle-select";
const RECTANGLE_SELECTION_THRESHOLD_PIXELS = 4;
const TODAY_HIGHLIGHT_MODE_COLUMN = "column";
const TODAY_HIGHLIGHT_MODE_LINE = "line";
const TASK_HOVER_BUBBLE_OFFSET_Y_PIXELS = 14;
const DAY_HEADER_MODE = "day";
const WEEK_HEADER_MODE = "week";
const SECOND_HEADER_ROW_INDEX = 1;
const DAY_SELECTION_COLLAPSE_DELAY_MILLISECONDS = 400;
const SUNDAY_DAY_INDEX = 0;
const SATURDAY_DAY_INDEX = 6;
const ZOOM_IN_DIRECTION = 10;
const ZOOM_OUT_DIRECTION = -10;
const TASK_BAR_HORIZONTAL_INSET_PIXELS = 4;
const TASK_BAR_VERTICAL_INSET_PIXELS = 6;
const TASK_BAR_HEIGHT_PIXELS = 26;
const MIN_TASK_BAR_DISPLAY_WIDTH_PIXELS = 20;
const MIN_TASK_BAR_RESIZE_WIDTH_PIXELS = 36;
const TASK_BAR_RESIZE_HANDLE_WIDTH_PIXELS = 10;
const TASK_BAR_LABEL_HORIZONTAL_PADDING_PIXELS = 8;
const TASK_BAR_LABEL_FONT = "700 13.76px Roboto, Arial, sans-serif";
const EVENT_BAR_HEIGHT_PIXELS = 88;
const EVENT_BAR_VIEWPORT_INSET_PIXELS = 16;
const EVENT_BAR_VERTICAL_OFFSET_PIXELS = 12;
const EVENT_BAR_SCREEN_BOTTOM_OFFSET_PIXELS = 0;
const EVENT_MARKER_SIZE_PIXELS = 34;
const EVENT_MARKER_COLUMN_NORMAL = "normal";
const EVENT_MARKER_COLUMN_WEEKEND = "weekend";
const EVENT_MARKER_COLUMN_TODAY = "today";
const EVENT_FLAG_LIGHT_TEXT_COLOR = "#ffffff";
const EVENT_FLAG_DARK_TEXT_COLOR = "#1f2937";
const COMPLETED_PROGRESS_PERCENT = 100;
const PERCENT_DIVISOR = 100;
const HEX_COLOR_LENGTH = 7;
const HEX_COLOR_RADIX = 16;
const HEX_RED_START_INDEX = 1;
const HEX_GREEN_START_INDEX = 3;
const HEX_BLUE_START_INDEX = 5;
const HEX_CHANNEL_LENGTH = 2;
const RGB_MAX_CHANNEL_VALUE = 255;
const LINEAR_RGB_THRESHOLD = 0.03928;
const LINEAR_RGB_DIVISOR = 12.92;
const GAMMA_RGB_OFFSET = 0.055;
const GAMMA_RGB_DIVISOR = 1.055;
const GAMMA_RGB_EXPONENT = 2.4;
const RED_LUMINANCE_WEIGHT = 0.2126;
const GREEN_LUMINANCE_WEIGHT = 0.7152;
const BLUE_LUMINANCE_WEIGHT = 0.0722;
const CONTRAST_RATIO_OFFSET = 0.05;
const MINIMUM_TASK_DURATION_DAYS = 1;
const NO_ELAPSED_TASK_DAYS = 0;
const INITIAL_VISIBLE_TIMELINE_RANGE = {
    left: 0,
    right: TIMELINE_HEADER_OVERSCAN_PIXELS * 2,
};
const INITIAL_FIXED_EVENT_BAR_LAYOUT = {
    bottom: EVENT_BAR_SCREEN_BOTTOM_OFFSET_PIXELS,
    left: 0,
    width: 0,
};
const taskBarLabelWidthCache = new Map();
let taskBarLabelMeasureContext = null;


export default function TimelineChart(props) {
    const {
        panelRef: externalPanelRef,
        tasks,
        dayOffs = [],
        projectNames = [],
        cutTaskIds = [],
        highlightedTaskId,
        isLoading,
        isRowReorderDisabled = false,
        selectedDayOffDates = [],
        selectedTaskIds,
        showTimelineHorizontalGridLines = true,
        zoomIndex,
        onClearHighlight,
        onHighlightTask,
        onMoveTasks,
        onOpenDayOffEdit,
        onOpenTaskEdit,
        onPanelScroll,
        onResizeTaskDates,
        onSelectTask,
        onSelectTasks,
        onSelectDayOffDate,
        onTimelineZoom,
    } = props;

    const timelinePanelRef = useRef(null);
    const dragStateRef = useRef(null);
    const didSetInitialScrollRef = useRef(false);
    const metricsRef = useRef(null);
    const tasksRef = useRef(tasks);
    const onClearHighlightRef = useRef(onClearHighlight);
    const onMoveTasksRef = useRef(onMoveTasks);
    const onResizeTaskDatesRef = useRef(onResizeTaskDates);
    const onSelectTaskRef = useRef(onSelectTask);
    const onSelectTasksRef = useRef(onSelectTasks);
    const onTimelineZoomRef = useRef(onTimelineZoom);
    const pendingTaskDragPointerRef = useRef(null);
    const pendingZoomAnchorRef = useRef(null);
    const pendingResizeAnchorRef = useRef(null);
    const pendingDaySelectionTimeoutRef = useRef(null);
    const panelSizeFrameIdRef = useRef(null);
    const visibleTimelineRangeFrameIdRef = useRef(null);
    const pendingTimelinePanPointerRef = useRef(null);
    const pendingWheelZoomDirectionRef = useRef(null);
    const eventBarRef = useRef(null);
    const taskDragFrameIdRef = useRef(null);
    const timelinePanFrameIdRef = useRef(null);
    const timelineZoomFrameIdRef = useRef(null);
    const taskBarElementsRef = useRef(new Map());
    const taskDragPreviewTaskIdsRef = useRef([]);
    const taskHoverBubbleRef = useRef(null);
    const taskHoverBubbleTaskIdRef = useRef(null);
    const taskHoverFrameIdRef = useRef(null);
    const taskHoverPositionRef = useRef(null);
    const pendingTaskHoverPositionRef = useRef(null);
    const [panelWidth, setPanelWidth] = useState(0);
    const [panelHeight, setPanelHeight] = useState(0);
    const [selectionRectangle, setSelectionRectangle] = useState(null);
    const [taskDragPreview, setTaskDragPreview] = useState(null);
    const [taskHoverBubble, setTaskHoverBubble] = useState(null);
    const [eventBarFixedLayout, setEventBarFixedLayout] = useState(
        INITIAL_FIXED_EVENT_BAR_LAYOUT,
    );
    const [visibleTimelineRange, setVisibleTimelineRange] = useState(
        INITIAL_VISIBLE_TIMELINE_RANGE,
    );

    const scaleMetrics = useMemo(function memoizeTimelineScaleMetrics() {
        return getTimelineScaleMetrics(tasks, zoomIndex, panelWidth);
    }, [panelWidth, tasks, zoomIndex]);
    const timelineTaskBars = useMemo(function memoizeTimelineTaskBars() {
        return getTimelineTaskBars(tasks, scaleMetrics.gridCells);
    }, [scaleMetrics.gridCells, tasks]);
    const metrics = useMemo(function memoizeTimelineMetrics() {
        return {
            ...scaleMetrics,
            bars: timelineTaskBars,
        };
    }, [scaleMetrics, timelineTaskBars]);
    const draggedTaskIdSet = useMemo(function memoizeDraggedTaskIdSet() {
        if (!taskDragPreview) {
            return new Set();
        }

        return new Set(taskDragPreview.taskIds);
    }, [taskDragPreview]);
    const cutTaskIdSet = useMemo(function memoizeCutTaskIdSet() {
        return new Set(cutTaskIds);
    }, [cutTaskIds]);
    const timelineBodyRowCount = useMemo(function memoizeTimelineBodyRowCount() {
        return getTimelineBodyRowCount(
            tasks.length,
            panelHeight,
            metrics.headerHeight,
            metrics.rowHeight,
        );
    }, [metrics, panelHeight, tasks.length]);
    const timelineBackground = useMemo(function memoizeTimelineBackground() {
        return getTimelineBackground(scaleMetrics, timelineBodyRowCount);
    }, [scaleMetrics, timelineBodyRowCount]);
    const timelineBodyHeight = timelineBackground.bodyHeight;
    const timelineTodayHighlight = timelineBackground.todayHighlight;
    const timelineHeaderLayoutRows = useMemo(function memoizeTimelineHeaderLayoutRows() {
        return getTimelineHeaderLayoutRows(metrics.headerRows);
    }, [metrics.headerRows]);
    const timelineHeaderRows = useMemo(function memoizeVisibleTimelineHeaderRows() {
        return getVisibleTimelineHeaderRows(timelineHeaderLayoutRows, visibleTimelineRange);
    }, [timelineHeaderLayoutRows, visibleTimelineRange]);
    const chartHeight = metrics.headerHeight + timelineBodyHeight;
    const headerRowHeight = getTimelineHeaderRowHeight(metrics.headerHeight, metrics.headerRows);
    const taskRowHighlights = useMemo(function memoizeTaskRowHighlights() {
        return getTaskRowHighlights(tasks, selectedTaskIds, highlightedTaskId);
    }, [highlightedTaskId, selectedTaskIds, tasks]);
    const selectedDayOffDateSet = useMemo(function memoizeSelectedDayOffDateSet() {
        return new Set(selectedDayOffDates);
    }, [selectedDayOffDates]);
    const selectedDayHighlights = useMemo(function memoizeSelectedDayHighlights() {
        return getSelectedDayHighlights(selectedDayOffDates, metrics);
    }, [metrics, selectedDayOffDates]);
    const dayOffHighlights = useMemo(function memoizeDayOffHighlights() {
        return getDayOffHighlights(dayOffs, tasks, metrics);
    }, [dayOffs, metrics, tasks]);
    const projectColorMap = useMemo(function memoizeProjectColorMap() {
        return getProjectColorMap(projectNames);
    }, [projectNames]);
    const eventGroups = useMemo(function memoizeEventGroups() {
        return getReleaseEventGroups(tasks, metrics, projectColorMap);
    }, [metrics, projectColorMap, tasks]);
    metricsRef.current = metrics;
    tasksRef.current = tasks;

    const setTimelinePanelElement = useCallback(function setTimelinePanelElement(panel) {
        timelinePanelRef.current = panel;

        if (externalPanelRef) {
            externalPanelRef.current = panel;
        }

        if (panel) {
            syncEventBarScrollPosition(panel);
            updateFixedEventBarLayout(panel);
            scheduleVisibleTimelineRangeUpdate(panel);
        }
    }, [externalPanelRef]);

    useEffect(function keepTimelineZoomHandlerCurrent() {
        onTimelineZoomRef.current = onTimelineZoom;
    }, [onTimelineZoom]);

    useEffect(function keepTimelineClearHandlersCurrent() {
        onClearHighlightRef.current = onClearHighlight;
    }, [onClearHighlight]);

    useEffect(function keepTaskDragHandlersCurrent() {
        onMoveTasksRef.current = onMoveTasks;
        onResizeTaskDatesRef.current = onResizeTaskDates;
        onSelectTaskRef.current = onSelectTask;
        onSelectTasksRef.current = onSelectTasks;
    }, [onMoveTasks, onResizeTaskDates, onSelectTask, onSelectTasks]);

    useEffect(function clearPendingDaySelectionOnUnmount() {
        return function clearPendingTimelineWork() {
            clearPendingDaySelection();
            cancelPanelSizeFrame();
            cancelTaskDragPreviewFrame();
            cancelTaskHoverFrame();
            cancelTimelinePanFrame();
            cancelTimelineZoomFrame();
            cancelVisibleTimelineRangeFrame();
            clearMoveTaskDragPreview();
            taskBarElementsRef.current.clear();
        };
    }, []);

    useLayoutEffect(function keepTaskHoverBubblePositionSynced() {
        applyStoredTaskHoverBubblePosition();
    });

    useLayoutEffect(function keepEventBarScrollPositionSynced() {
        const panel = timelinePanelRef.current;

        if (!panel) {
            return;
        }

        syncEventBarScrollPosition(panel);
    });

    useLayoutEffect(function trackTimelinePanelSize() {
        const panel = timelinePanelRef.current;

        if (!panel) {
            return undefined;
        }

        function scheduleObservedPanelSizeUpdate() {
            schedulePanelSizeUpdate(panel);
        }

        scheduleObservedPanelSizeUpdate();

        if (typeof ResizeObserver === "undefined") {
            window.addEventListener("resize", scheduleObservedPanelSizeUpdate);

            return function removeWindowResizeListener() {
                window.removeEventListener("resize", scheduleObservedPanelSizeUpdate);
                cancelPanelSizeFrame();
            };
        }

        const resizeObserver = new ResizeObserver(scheduleObservedPanelSizeUpdate);
        resizeObserver.observe(panel);

        return function disconnectResizeObserver() {
            resizeObserver.disconnect();
            cancelPanelSizeFrame();
        };
    }, []);

    useLayoutEffect(function alignScrollWithTimelineScale() {
        const panel = timelinePanelRef.current;

        if (!panel) {
            return;
        }

        if (isLoading) {
            return;
        }

        if (!didSetInitialScrollRef.current) {
            panel.scrollLeft = getCenteredTodayScrollLeft(panel, metrics);
            didSetInitialScrollRef.current = true;
            updateVisibleTimelineRange(panel);
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
            updateVisibleTimelineRange(panel);
            return;
        }

        if (pendingResizeAnchorRef.current) {
            const anchor = pendingResizeAnchorRef.current;
            const anchorOffset = getTimelineOffsetForDate(
                anchor.date,
                anchor.dayRatio,
                metrics.gridCells,
            );

            panel.scrollLeft = anchorOffset - anchor.viewportOffset;
            pendingResizeAnchorRef.current = null;
            updateVisibleTimelineRange(panel);
            return;
        }

        updateVisibleTimelineRange(panel);
    }, [isLoading, metrics]);

    function schedulePanelSizeUpdate(panel) {
        if (didSetInitialScrollRef.current && metricsRef.current) {
            pendingResizeAnchorRef.current = getPanelCenterAnchor(
                panel,
                metricsRef.current.gridCells,
            );
        }

        if (panelSizeFrameIdRef.current !== null) {
            return;
        }

        panelSizeFrameIdRef.current = window.requestAnimationFrame(
            function updatePanelSizeFrame() {
                const nextPanelWidth = panel.clientWidth;
                const nextPanelHeight = panel.clientHeight;
                const nextEventBarFixedLayout = getFixedEventBarLayout(panel);

                panelSizeFrameIdRef.current = null;

                updateVisibleTimelineRange(panel);
                setEventBarFixedLayout(function updateMeasuredEventBarFixedLayout(
                    currentEventBarFixedLayout,
                ) {
                    if (
                        hasSameFixedEventBarLayout(
                            currentEventBarFixedLayout,
                            nextEventBarFixedLayout,
                        )
                    ) {
                        return currentEventBarFixedLayout;
                    }

                    return nextEventBarFixedLayout;
                });
                setPanelWidth(function updateMeasuredPanelWidth(currentPanelWidth) {
                    if (currentPanelWidth === nextPanelWidth) {
                        pendingResizeAnchorRef.current = null;
                        return currentPanelWidth;
                    }

                    return nextPanelWidth;
                });
                setPanelHeight(function updateMeasuredPanelHeight(currentPanelHeight) {
                    if (currentPanelHeight === nextPanelHeight) {
                        return currentPanelHeight;
                    }

                    return nextPanelHeight;
                });
            },
        );
    }

    function cancelPanelSizeFrame() {
        if (panelSizeFrameIdRef.current === null) {
            return;
        }

        window.cancelAnimationFrame(panelSizeFrameIdRef.current);
        panelSizeFrameIdRef.current = null;
        pendingResizeAnchorRef.current = null;
    }

    function scheduleVisibleTimelineRangeUpdate(panel) {
        if (visibleTimelineRangeFrameIdRef.current !== null) {
            return;
        }

        visibleTimelineRangeFrameIdRef.current = window.requestAnimationFrame(
            function updateVisibleTimelineRangeFrame() {
                visibleTimelineRangeFrameIdRef.current = null;

                if (!panel || panel !== timelinePanelRef.current) {
                    return;
                }

                updateVisibleTimelineRange(panel);
            },
        );
    }

    function updateVisibleTimelineRange(panel) {
        const timelineWidth = metricsRef.current ? metricsRef.current.timelineWidth : 0;
        const nextVisibleTimelineRange = getVisibleTimelineRange(panel, timelineWidth);

        syncEventBarScrollPosition(panel);
        setVisibleTimelineRange(function updateCurrentVisibleTimelineRange(
            currentVisibleTimelineRange,
        ) {
            if (
                hasSameVisibleTimelineRange(
                    currentVisibleTimelineRange,
                    nextVisibleTimelineRange,
                )
            ) {
                return currentVisibleTimelineRange;
            }

            return nextVisibleTimelineRange;
        });
    }

    function updateFixedEventBarLayout(panel) {
        setEventBarFixedLayout(function updateCurrentEventBarFixedLayout(
            currentEventBarFixedLayout,
        ) {
            const nextEventBarFixedLayout = getFixedEventBarLayout(panel);

            if (
                hasSameFixedEventBarLayout(
                    currentEventBarFixedLayout,
                    nextEventBarFixedLayout,
                )
            ) {
                return currentEventBarFixedLayout;
            }

            return nextEventBarFixedLayout;
        });
    }

    function syncEventBarScrollPosition(panel) {
        if (!eventBarRef.current) {
            return;
        }

        eventBarRef.current.style.setProperty(
            "--timeline-scroll-left",
            `${panel.scrollLeft}px`,
        );
    }

    function cancelVisibleTimelineRangeFrame() {
        if (visibleTimelineRangeFrameIdRef.current === null) {
            return;
        }

        window.cancelAnimationFrame(visibleTimelineRangeFrameIdRef.current);
        visibleTimelineRangeFrameIdRef.current = null;
    }

    function scheduleTimelinePan(dragState, event) {
        pendingTimelinePanPointerRef.current = {
            clientX: event.clientX,
            clientY: event.clientY,
        };

        if (timelinePanFrameIdRef.current !== null) {
            return;
        }

        timelinePanFrameIdRef.current = window.requestAnimationFrame(
            function updateTimelinePanFrame() {
                const pendingPointer = pendingTimelinePanPointerRef.current;

                timelinePanFrameIdRef.current = null;
                pendingTimelinePanPointerRef.current = null;

                if (!pendingPointer || dragStateRef.current !== dragState) {
                    return;
                }

                updateTimelinePan(dragState, pendingPointer);
            },
        );
    }

    function updateTimelinePan(dragState, pointer) {
        const dragDistance = pointer.clientX - dragState.startClientX;
        const movement = getPointerMovement(dragState, pointer);

        if (movement >= TIMELINE_PAN_MOVED_THRESHOLD_PIXELS) {
            dragState.hasMoved = true;
        }

        dragState.panel.scrollLeft = dragState.startScrollLeft - dragDistance;
        syncEventBarScrollPosition(dragState.panel);
    }

    function flushTimelinePanFrame(dragState) {
        const pendingPointer = pendingTimelinePanPointerRef.current;

        if (timelinePanFrameIdRef.current !== null) {
            window.cancelAnimationFrame(timelinePanFrameIdRef.current);
            timelinePanFrameIdRef.current = null;
        }

        pendingTimelinePanPointerRef.current = null;

        if (!pendingPointer) {
            return;
        }

        updateTimelinePan(dragState, pendingPointer);
    }

    function cancelTimelinePanFrame() {
        if (timelinePanFrameIdRef.current === null) {
            return;
        }

        window.cancelAnimationFrame(timelinePanFrameIdRef.current);
        timelinePanFrameIdRef.current = null;
        pendingTimelinePanPointerRef.current = null;
    }

    function startRectangleSelection(panel, event) {
        const currentMetrics = metricsRef.current;
        const startPoint = getTimelineSelectionPoint(
            panel,
            event,
            currentMetrics.timelineWidth,
            currentMetrics.headerHeight,
            timelineBodyHeight,
        );

        dragStateRef.current = {
            type: TIMELINE_DRAG_TYPE_RECTANGLE_SELECT,
            panel,
            startClientX: event.clientX,
            startClientY: event.clientY,
            startPoint,
            currentPoint: startPoint,
            bodyHeight: timelineBodyHeight,
            headerHeight: currentMetrics.headerHeight,
            selectionMode: getRectangleSelectionMode(event),
            timelineWidth: currentMetrics.timelineWidth,
            hasMoved: false,
        };
    }

    function updateRectangleSelectionPreview(dragState, event) {
        const movement = getPointerMovement(dragState, event);

        if (!dragState.hasMoved && movement < RECTANGLE_SELECTION_THRESHOLD_PIXELS) {
            return;
        }

        dragState.hasMoved = true;
        dragState.currentPoint = getTimelineSelectionPoint(
            dragState.panel,
            event,
            dragState.timelineWidth,
            dragState.headerHeight,
            dragState.bodyHeight,
        );

        setSelectionRectangle(getSelectionRectangle(dragState.startPoint, dragState.currentPoint));
    }

    function finishRectangleSelection(dragState, event) {
        const movement = getPointerMovement(dragState, event);
        const hasSelectedByDrag = dragState.hasMoved
            || movement >= RECTANGLE_SELECTION_THRESHOLD_PIXELS;

        dragStateRef.current = null;
        setSelectionRectangle(null);

        if (!hasSelectedByDrag) {
            clearTimelineTaskSelection();
            return;
        }

        const currentPoint = getTimelineSelectionPoint(
            dragState.panel,
            event,
            dragState.timelineWidth,
            dragState.headerHeight,
            dragState.bodyHeight,
        );
        const rectangle = getSelectionRectangle(dragState.startPoint, currentPoint);
        const taskIds = getRectangleSelectedTaskIds(
            metricsRef.current.bars,
            rectangle,
            isLeftToRightSelection(dragState.startPoint, currentPoint),
        );

        onClearHighlightRef.current();
        onSelectTasksRef.current(taskIds, dragState.selectionMode, tasksRef.current);
    }

    function scheduleTimelineZoom(zoomDirection) {
        pendingWheelZoomDirectionRef.current = zoomDirection;

        if (timelineZoomFrameIdRef.current !== null) {
            return;
        }

        timelineZoomFrameIdRef.current = window.requestAnimationFrame(
            function updateTimelineZoomFrame() {
                const pendingZoomDirection = pendingWheelZoomDirectionRef.current;

                timelineZoomFrameIdRef.current = null;
                pendingWheelZoomDirectionRef.current = null;

                if (pendingZoomDirection === null) {
                    return;
                }

                onTimelineZoomRef.current(pendingZoomDirection);
            },
        );
    }


    function cancelTimelineZoomFrame() {
        if (timelineZoomFrameIdRef.current === null) {
            return;
        }

        window.cancelAnimationFrame(timelineZoomFrameIdRef.current);
        timelineZoomFrameIdRef.current = null;
        pendingWheelZoomDirectionRef.current = null;
    }


    function clearTimelineTaskSelection() {
        onClearHighlightRef.current();
        onSelectTasksRef.current([], getDefaultSelectionMode(), tasksRef.current);
    }

    useEffect(function bindDragListeners() {
        function handleMouseMove(event) {
            const dragState = dragStateRef.current;

            if (!dragState) {
                return;
            }

            if (isTaskInteractionDrag(dragState)) {
                scheduleTaskDragPreview(dragState, event);
                return;
            }

            if (isRectangleSelectionDrag(dragState)) {
                updateRectangleSelectionPreview(dragState, event);
                return;
            }

            if (isTimelinePanDrag(dragState)) {
                scheduleTimelinePan(dragState, event);
            }
        }

        function handleMouseUp(event) {
            const dragState = dragStateRef.current;

            if (!dragState) {
                return;
            }

            if (isTaskInteractionDrag(dragState)) {
                finishTaskDrag(dragState, event);
                return;
            }

            if (isRectangleSelectionDrag(dragState)) {
                finishRectangleSelection(dragState, event);
                return;
            }

            flushTimelinePanFrame(dragState);

            dragStateRef.current = null;
            setTimelinePanelDragging(dragState.panel, false);
        }

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);

        return function removeDragListeners() {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
            cancelTimelinePanFrame();
            setTimelinePanelDragging(timelinePanelRef.current, false);
        };
    }, []);

    useEffect(function bindWheelListener() {
        const panel = timelinePanelRef.current;

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
                scheduleTimelineZoom(getWheelZoomDirection(event));
                return;
            }

            if (shouldScrollTimelineHorizontally(event)) {
                event.preventDefault();
                scrollTimelineHorizontally(panel, getHorizontalWheelDelta(event));
                syncEventBarScrollPosition(panel);
            }
        }

        panel.addEventListener("wheel", handleTimelineWheel, {
            passive: false,
        });

        return function removeWheelListener() {
            panel.removeEventListener("wheel", handleTimelineWheel);
            cancelTimelineZoomFrame();
        };
    }, []);

    function handleTimelinePanelScroll(event) {
        syncEventBarScrollPosition(event.currentTarget);
        scheduleVisibleTimelineRangeUpdate(event.currentTarget);
        onPanelScroll(event);
    }

    function handleTimelineMouseDown(event) {
        if (event.target instanceof Element && event.target.closest(".task-bar")) {
            return;
        }

        if (event.target instanceof Element && event.target.closest(".timeline-header")) {
            return;
        }

        const panel = timelinePanelRef.current;

        if (!panel) {
            return;
        }

        if (isTimelineScrollbarMouseDown(event, panel)) {
            return;
        }

        event.preventDefault();

        if (event.button === LEFT_MOUSE_BUTTON) {
            startRectangleSelection(panel, event);
            return;
        }

        if (event.button !== RIGHT_MOUSE_BUTTON) {
            return;
        }

        dragStateRef.current = {
            type: TIMELINE_DRAG_TYPE_PAN,
            panel,
            startClientX: event.clientX,
            startClientY: event.clientY,
            startScrollLeft: panel.scrollLeft,
            hasMoved: false,
        };
        setTimelinePanelDragging(panel, true);
    }

    function handleTimelineContextMenu(event) {
        event.preventDefault();
    }

    function handleTaskBarMouseDown(event, task) {
        if (event.button !== LEFT_MOUSE_BUTTON) {
            return;
        }

        const panel = timelinePanelRef.current;

        if (!panel) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        hideTaskHoverBubble();

        const selectionMode = getTaskSelectionMode(event);

        if (selectionMode.isMultiSelect || selectionMode.isRangeSelect) {
            onClearHighlight();
            onSelectTask(task.id, selectionMode, tasks);
            return;
        }

        onHighlightTask(task.id);

        const taskIds = getTaskInteractionIds(tasks, selectedTaskIds, task.id);

        if (!selectedTaskIds.includes(task.id)) {
            onSelectTask(task.id, selectionMode, tasks);
        }

        dragStateRef.current = {
            type: TASK_DRAG_TYPE_MOVE,
            taskId: task.id,
            taskIds,
            isRowReorderDisabled,
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
        if (dragStateRef.current && isTaskInteractionDrag(dragStateRef.current)) {
            return;
        }

        showTaskHoverBubble(event, task);
    }

    function handleTaskBarMouseLeave() {
        hideTaskHoverBubble();
    }

    function showTaskHoverBubble(event, task) {
        scheduleTaskHoverBubblePosition(event);

        if (taskHoverBubbleTaskIdRef.current === task.id) {
            return;
        }

        taskHoverBubbleTaskIdRef.current = task.id;
        setTaskHoverBubble({ task });
    }

    function hideTaskHoverBubble() {
        taskHoverBubbleTaskIdRef.current = null;
        taskHoverPositionRef.current = null;
        pendingTaskHoverPositionRef.current = null;
        cancelTaskHoverFrame();
        setTaskHoverBubble(null);
    }

    function scheduleTaskHoverBubblePosition(event) {
        const nextPosition = {
            x: event.clientX,
            y: event.clientY + TASK_HOVER_BUBBLE_OFFSET_Y_PIXELS,
        };

        pendingTaskHoverPositionRef.current = nextPosition;
        taskHoverPositionRef.current = nextPosition;

        if (taskHoverFrameIdRef.current !== null) {
            return;
        }

        taskHoverFrameIdRef.current = window.requestAnimationFrame(
            function updateTaskHoverBubblePositionFrame() {
                taskHoverFrameIdRef.current = null;
                flushTaskHoverBubblePosition();
            },
        );
    }

    function flushTaskHoverBubblePosition() {
        const pendingPosition = pendingTaskHoverPositionRef.current;

        if (!pendingPosition) {
            return;
        }

        pendingTaskHoverPositionRef.current = null;
        applyTaskHoverBubblePosition(pendingPosition);
    }

    function applyStoredTaskHoverBubblePosition() {
        const currentPosition = taskHoverPositionRef.current;

        if (!currentPosition) {
            return;
        }

        applyTaskHoverBubblePosition(currentPosition);
    }

    function applyTaskHoverBubblePosition(position) {
        const bubbleElement = taskHoverBubbleRef.current;

        if (!bubbleElement) {
            return;
        }

        bubbleElement.style.transform = getTaskHoverBubbleTransform(position.x, position.y);
    }

    function cancelTaskHoverFrame() {
        if (taskHoverFrameIdRef.current === null) {
            return;
        }

        window.cancelAnimationFrame(taskHoverFrameIdRef.current);
        taskHoverFrameIdRef.current = null;
    }

    function handleHeaderDayMouseDown(event, segment) {
        event.preventDefault();
        event.stopPropagation();

        if (event.detail > 1) {
            clearPendingDaySelection();
            return;
        }

        selectHeaderDayFromMouseEvent(event, segment);
    }

    function handleHeaderDayKeyDown(event, segment) {
        if (event.key !== "Enter" && event.key !== " ") {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        selectHeaderDay(event, segment);
    }

    function handleHeaderDayDoubleClick(event, segment) {
        event.preventDefault();
        event.stopPropagation();
        clearPendingDaySelection();
        onOpenDayOffEdit(formatDateString(segment.startDate));
    }

    function selectHeaderDayFromMouseEvent(event, segment) {
        const date = formatDateString(segment.startDate);
        const selectionMode = getDaySelectionMode(event);

        if (shouldDelaySelectedRangeCollapse(date, selectionMode)) {
            scheduleHeaderDaySelection(date, selectionMode);
            return;
        }

        clearPendingDaySelection();
        onSelectDayOffDate(date, selectionMode);
    }

    function selectHeaderDay(event, segment) {
        clearPendingDaySelection();
        onSelectDayOffDate(formatDateString(segment.startDate), getDaySelectionMode(event));
    }

    function scheduleHeaderDaySelection(date, selectionMode) {
        clearPendingDaySelection();

        pendingDaySelectionTimeoutRef.current = window.setTimeout(
            function selectPendingHeaderDay() {
                pendingDaySelectionTimeoutRef.current = null;
                onSelectDayOffDate(date, selectionMode);
            },
            DAY_SELECTION_COLLAPSE_DELAY_MILLISECONDS,
        );
    }

    function clearPendingDaySelection() {
        if (!pendingDaySelectionTimeoutRef.current) {
            return;
        }

        window.clearTimeout(pendingDaySelectionTimeoutRef.current);
        pendingDaySelectionTimeoutRef.current = null;
    }

    function shouldDelaySelectedRangeCollapse(date, selectionMode) {
        return (
            selectedDayOffDates.length > 1
            && selectedDayOffDates.includes(date)
            && !selectionMode.isMultiSelect
            && !selectionMode.isRangeSelect
        );
    }

    function handleTaskResizeMouseDown(event, task, resizeEdge) {
        if (event.button !== LEFT_MOUSE_BUTTON) {
            return;
        }

        const panel = timelinePanelRef.current;

        if (!panel) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        hideTaskHoverBubble();
        onHighlightTask(task.id);

        if (selectedTaskIds.length > 1) {
            return;
        }

        onSelectTask(task.id);

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

    function scheduleTaskDragPreview(dragState, event) {
        pendingTaskDragPointerRef.current = {
            clientX: event.clientX,
            clientY: event.clientY,
        };

        if (taskDragFrameIdRef.current !== null) {
            return;
        }

        taskDragFrameIdRef.current = window.requestAnimationFrame(
            function runTaskDragPreviewFrame() {
                const pendingPointer = pendingTaskDragPointerRef.current;

                taskDragFrameIdRef.current = null;
                pendingTaskDragPointerRef.current = null;

                if (!pendingPointer || dragStateRef.current !== dragState) {
                    return;
                }

                updateTaskDragPreview(dragState, pendingPointer);
            },
        );
    }

    function updateTaskDragPreview(dragState, pointer) {
        const movement = getPointerMovement(dragState, pointer);
        const hasJustStartedMoving = !dragState.hasMoved;

        if (hasJustStartedMoving && movement < TASK_DRAG_THRESHOLD_PIXELS) {
            return;
        }

        dragState.hasMoved = true;

        if (hasJustStartedMoving) {
            hideTaskHoverBubble();
        }

        dragState.pixelDelta = pointer.clientX - dragState.startClientX;
        dragState.pixelDeltaY = getTaskDragPreviewPixelDeltaY(dragState, pointer);

        if (dragState.type === TASK_DRAG_TYPE_MOVE) {
            applyMoveTaskDragPreview(dragState);
            return;
        }

        setTaskDragPreview({
            taskId: dragState.taskId,
            taskIds: dragState.taskIds,
            type: dragState.type,
            resizeEdge: dragState.resizeEdge,
            pixelDelta: dragState.pixelDelta,
            pixelDeltaY: dragState.pixelDeltaY,
        });
    }

    function applyMoveTaskDragPreview(dragState) {
        const activeTaskIds = new Set(dragState.taskIds);

        taskDragPreviewTaskIdsRef.current.forEach(function clearInactiveTaskPreview(taskId) {
            if (activeTaskIds.has(taskId)) {
                return;
            }

            clearTaskBarMovePreview(taskId);
        });

        dragState.taskIds.forEach(function applyTaskMovePreview(taskId) {
            applyTaskBarMovePreview(taskId, dragState);
        });

        taskDragPreviewTaskIdsRef.current = [...dragState.taskIds];
    }

    function applyTaskBarMovePreview(taskId, dragState) {
        const taskBarElement = taskBarElementsRef.current.get(taskId);

        if (!taskBarElement) {
            return;
        }

        taskBarElement.classList.add("task-bar-drag-preview");
        taskBarElement.style.transform = getTaskBarMoveTransform(
            dragState.pixelDelta,
            dragState.pixelDeltaY,
        );
    }

    function clearMoveTaskDragPreview() {
        taskDragPreviewTaskIdsRef.current.forEach(clearTaskBarMovePreview);
        taskDragPreviewTaskIdsRef.current = [];
    }

    function clearTaskBarMovePreview(taskId) {
        const taskBarElement = taskBarElementsRef.current.get(taskId);

        if (!taskBarElement) {
            return;
        }

        taskBarElement.classList.remove("task-bar-drag-preview");
        taskBarElement.style.transform = "";
    }

    function cancelTaskDragPreviewFrame() {
        if (taskDragFrameIdRef.current === null) {
            return;
        }

        window.cancelAnimationFrame(taskDragFrameIdRef.current);
        taskDragFrameIdRef.current = null;
        pendingTaskDragPointerRef.current = null;
    }

    function flushTaskDragPreviewFrame(dragState) {
        const pendingPointer = pendingTaskDragPointerRef.current;

        if (taskDragFrameIdRef.current !== null) {
            window.cancelAnimationFrame(taskDragFrameIdRef.current);
            taskDragFrameIdRef.current = null;
        }

        pendingTaskDragPointerRef.current = null;

        if (!pendingPointer) {
            return;
        }

        updateTaskDragPreview(dragState, pendingPointer);
    }

    function handleTimelineMouseLeave() {
        hideTaskHoverBubble();
    }

    function finishTaskDrag(dragState, event) {
        flushTaskDragPreviewFrame(dragState);
        dragStateRef.current = null;
        clearMoveTaskDragPreview();
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

    function setTaskBarElement(taskId, taskBarElement) {
        if (!taskBarElement) {
            taskBarElementsRef.current.delete(taskId);
            return;
        }

        taskBarElementsRef.current.set(taskId, taskBarElement);
        applyCurrentTaskBarMovePreview(taskId);
    }

    function setTaskHoverBubbleElement(bubbleElement) {
        taskHoverBubbleRef.current = bubbleElement;
        applyStoredTaskHoverBubblePosition();
    }

    function applyCurrentTaskBarMovePreview(taskId) {
        const dragState = dragStateRef.current;

        if (
            !dragState
            || dragState.type !== TASK_DRAG_TYPE_MOVE
            || !dragState.hasMoved
            || !dragState.taskIds.includes(taskId)
        ) {
            return;
        }

        applyTaskBarMovePreview(taskId, dragState);
    }

    return (
        <Box
            ref={setTimelinePanelElement}
            className="timeline-panel"
            onContextMenu={handleTimelineContextMenu}
            onMouseDown={handleTimelineMouseDown}
            onMouseLeave={handleTimelineMouseLeave}
            onScroll={handleTimelinePanelScroll}
        >
            <Box
                className="timeline-canvas"
                sx={{
                    width: `${metrics.timelineWidth}px`,
                    minHeight: `max(100%, ${chartHeight}px)`,
                }}
            >
                <Box className="timeline-header" sx={{ height: `${metrics.headerHeight}px` }}>
                    {timelineHeaderRows.map(function renderHeaderRow(headerRow, rowIndex) {
                        return (
                            <Box
                                key={rowIndex}
                                className="timeline-header-row"
                                sx={{ height: `${headerRowHeight}px` }}
                            >
                                {headerRow.cells.map(function renderHeaderCell(segment) {
                                    const isSelectableDayCell = isTimelineHeaderDayCell(
                                        metrics,
                                        rowIndex,
                                        segment,
                                    );
                                    const isSelectedDayCell = (
                                        isSelectableDayCell
                                        && selectedDayOffDateSet.has(formatDateString(
                                            segment.startDate,
                                        ))
                                    );

                                    return (
                                        <Box
                                            key={segment.key}
                                            role={isSelectableDayCell ? "button" : undefined}
                                            tabIndex={isSelectableDayCell ? 0 : undefined}
                                            className={getTimelineHeaderCellClassName(
                                                isSelectableDayCell,
                                                isSelectedDayCell,
                                            )}
                                            sx={{
                                                left: `${segment.left}px`,
                                                width: `${segment.width}px`,
                                            }}
                                            onKeyDown={isSelectableDayCell
                                                ? function selectHeaderDayByKeyboard(event) {
                                                    handleHeaderDayKeyDown(event, segment);
                                                }
                                                : undefined}
                                            onMouseDown={isSelectableDayCell
                                                ? function selectHeaderDayByMouse(event) {
                                                    handleHeaderDayMouseDown(event, segment);
                                                }
                                                : undefined}
                                            onDoubleClick={isSelectableDayCell
                                                ? function openDayOffEdit(event) {
                                                    handleHeaderDayDoubleClick(event, segment);
                                                }
                                                : undefined}
                                        >
                                            {segment.label}
                                        </Box>
                                    );
                                })}
                                {headerRow.gridLines.map(function renderHeaderGridLine(gridLine) {
                                    return (
                                        <Box
                                            key={gridLine.key}
                                            className="timeline-header-grid-line"
                                            sx={{
                                                left: `${gridLine.left}px`,
                                            }}
                                        />
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
                    <svg
                        aria-hidden="true"
                        className="timeline-grid-svg"
                        focusable="false"
                        height={timelineBodyHeight}
                        viewBox={`0 0 ${metrics.timelineWidth} ${timelineBodyHeight}`}
                        width={metrics.timelineWidth}
                    >
                        {timelineBackground.weekendHighlights.map(
                            function renderWeekendHighlight(highlight) {
                                return (
                                    <rect
                                        key={highlight.key}
                                        className="timeline-weekend-highlight"
                                        height={highlight.height}
                                        width={highlight.width}
                                        x={highlight.left}
                                        y={0}
                                    />
                                );
                            },
                        )}
                        {timelineTodayHighlight?.mode === TODAY_HIGHLIGHT_MODE_COLUMN && (
                            <rect
                                className="timeline-today-highlight-column"
                                height={timelineTodayHighlight.height}
                                width={timelineTodayHighlight.width}
                                x={timelineTodayHighlight.left}
                                y={0}
                            />
                        )}
                        {timelineTodayHighlight?.mode === TODAY_HIGHLIGHT_MODE_LINE && (
                            <line
                                className="timeline-today-highlight-line"
                                strokeWidth={TIMELINE_TODAY_LINE_WIDTH_PIXELS}
                                x1={timelineTodayHighlight.left}
                                x2={timelineTodayHighlight.left}
                                y1={0}
                                y2={timelineTodayHighlight.height}
                            />
                        )}
                        <path
                            className="timeline-grid-path"
                            d={timelineBackground.verticalGridPath}
                        />
                        {showTimelineHorizontalGridLines && (
                            <path
                                className="timeline-grid-path"
                                d={timelineBackground.horizontalGridPath}
                            />
                        )}
                    </svg>
                </Box>
                <Box
                    className="timeline-day-off-highlights"
                    sx={{
                        top: `${metrics.headerHeight}px`,
                    }}
                >
                    {dayOffHighlights.map(function renderDayOffHighlight(highlight) {
                        return (
                            <Box
                                key={highlight.key}
                                className="timeline-day-off-highlight"
                                sx={{
                                    left: `${highlight.left}px`,
                                    top: `${highlight.top}px`,
                                    width: `${highlight.width}px`,
                                    height: `${highlight.height}px`,
                                }}
                            />
                        );
                    })}
                </Box>
                <Box
                    className="timeline-selected-day-highlights"
                    sx={{
                        top: `${metrics.headerHeight}px`,
                    }}
                >
                    {selectedDayHighlights.map(function renderSelectedDayHighlight(highlight) {
                        return (
                            <Box
                                key={highlight.key}
                                className="timeline-selected-day-highlight"
                                sx={{
                                    left: `${highlight.left}px`,
                                    width: `${highlight.width}px`,
                                }}
                            />
                        );
                    })}
                </Box>
                <Box
                    className="timeline-rows"
                    sx={{
                        top: `${metrics.headerHeight}px`,
                    }}
                >
                    {taskRowHighlights.map(function renderTaskRowHighlight(rowHighlight) {
                        return (
                            <Box
                                key={rowHighlight.taskId}
                                className="timeline-hover-row"
                                sx={{
                                    top: `${rowHighlight.index * metrics.rowHeight}px`,
                                    height: `${metrics.rowHeight}px`,
                                }}
                            />
                        );
                    })}
                </Box>
                <Box
                    className="timeline-bars"
                    sx={{
                        top: `${metrics.headerHeight}px`,
                    }}
                >
                    {metrics.bars.map(function renderTaskBar(bar) {
                        const isSelected = selectedTaskIds.includes(bar.task.id);
                        const isCut = cutTaskIdSet.has(bar.task.id);
                        const isDelayed = isTaskDelayed(bar.task, metrics.todayDate);
                        const isTaskDragPreviewTarget = draggedTaskIdSet.has(bar.task.id);
                        const taskBarLayout = getTaskBarLayout(
                            bar,
                            taskDragPreview,
                            isTaskDragPreviewTarget,
                        );
                        const taskBarVisualLayout = getTaskBarVisualLayout(taskBarLayout);
                        const taskBarTransform = getTaskBarTransform(
                            taskDragPreview,
                            isTaskDragPreviewTarget,
                        );
                        const canResizeTask = (
                            selectedTaskIds.length <= 1
                            && taskBarVisualLayout.width >= MIN_TASK_BAR_RESIZE_WIDTH_PIXELS
                        );
                        const shouldShowTaskLabel = shouldShowTaskBarLabel(
                            bar.task.name,
                            taskBarVisualLayout.width,
                            canResizeTask,
                        );

                        return (
                            <Box
                                key={bar.task.id}
                                ref={function setRenderedTaskBarElement(taskBarElement) {
                                    setTaskBarElement(bar.task.id, taskBarElement);
                                }}
                                aria-label={bar.task.name}
                                role="button"
                                tabIndex={0}
                                className={getTaskBarClassName(
                                    isSelected,
                                    isCut,
                                    isDelayed,
                                    isTaskDragPreviewTarget,
                                )}
                                sx={{
                                    left: `${taskBarVisualLayout.left}px`,
                                    top: `${taskBarVisualLayout.top}px`,
                                    width: `${taskBarVisualLayout.width}px`,
                                    backgroundColor: getTaskColor(bar.task),
                                    transform: taskBarTransform,
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
                                        const selectionMode = getTaskSelectionMode(event);

                                        event.preventDefault();

                                        if (
                                            selectionMode.isMultiSelect
                                            || selectionMode.isRangeSelect
                                        ) {
                                            onClearHighlight();
                                        } else {
                                            onHighlightTask(bar.task.id);
                                        }

                                        onSelectTask(bar.task.id, selectionMode, tasks);
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
                                {shouldShowTaskLabel && (
                                    <Typography className="task-bar-label">
                                        {bar.task.name}
                                    </Typography>
                                )}
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
                            ref={setTaskHoverBubbleElement}
                            className="task-hover-bubble"
                        >
                            <Typography className="task-hover-bubble-title">
                                {taskHoverBubble.task.name}
                            </Typography>
                            <Box className="task-hover-bubble-grid">
                                <Typography className="task-hover-bubble-label">
                                    Task type
                                </Typography>
                                <Typography className="task-hover-bubble-value">
                                    {getTaskTypeLabel(taskHoverBubble.task)}
                                </Typography>
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
                <Box
                    className="timeline-selection-layer"
                    sx={{
                        top: `${metrics.headerHeight}px`,
                        bottom: 0,
                    }}
                >
                    {selectionRectangle && (
                        <Box
                            className="timeline-selection-rectangle"
                            sx={{
                                left: `${selectionRectangle.left}px`,
                                top: `${selectionRectangle.top}px`,
                                width: `${selectionRectangle.width}px`,
                                height: `${selectionRectangle.height}px`,
                            }}
                        />
                    )}
                </Box>
                <Box
                    ref={eventBarRef}
                    className="timeline-event-bar"
                    sx={{
                        bottom: `${eventBarFixedLayout.bottom}px`,
                        height: `${EVENT_BAR_HEIGHT_PIXELS}px`,
                        left: `${eventBarFixedLayout.left}px`,
                        width: `${eventBarFixedLayout.width}px`,
                        "--timeline-event-marker-size": `${EVENT_MARKER_SIZE_PIXELS}px`,
                    }}
                    onMouseDown={function stopEventBarMouseDown(event) {
                        event.stopPropagation();
                    }}
                >
                    <Box
                        className="timeline-event-bar-track"
                        sx={{
                            left: `${EVENT_BAR_VIEWPORT_INSET_PIXELS}px`,
                            width: `${getFixedEventBarTrackWidth(eventBarFixedLayout.width)}px`,
                        }}
                    />
                    {eventGroups.map(function renderEventGroup(eventGroup) {
                        return (
                            <Box
                                key={eventGroup.key}
                                className={getEventMarkerClassName(eventGroup.columnType)}
                                sx={{
                                    left: (
                                        `calc(${eventGroup.left}px - var(--timeline-scroll-left, 0px))`
                                    ),
                                }}
                            >
                                <Box className="timeline-event-count">
                                    {eventGroup.events.length}
                                </Box>
                                <Box className="timeline-event-flags">
                                    {eventGroup.events.map(function renderEventFlag(eventItem) {
                                        return (
                                            <Box
                                                key={eventItem.id}
                                                className="timeline-event-flag"
                                                sx={getEventFlagStyle(eventItem)}
                                            >
                                                <Box
                                                    component="span"
                                                    className="timeline-event-flag-text"
                                                >
                                                    {eventItem.name}
                                                </Box>
                                            </Box>
                                        );
                                    })}
                                </Box>
                            </Box>
                        );
                    })}
                </Box>
            </Box>
        </Box>
    );
}


function getTaskTypeLabel(task) {
    return task.taskType || "Unknown";
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


function isTimelineHeaderDayCell(metrics, rowIndex, segment) {
    return (
        metrics.headerMode === DAY_HEADER_MODE
        && rowIndex === SECOND_HEADER_ROW_INDEX
        && segment.dayCount === 1
    );
}


function getTimelineHeaderCellClassName(isSelectableDayCell, isSelectedDayCell) {
    const classNames = ["timeline-header-cell"];

    if (isSelectableDayCell) {
        classNames.push("timeline-header-day-cell");
    }

    if (isSelectedDayCell) {
        classNames.push("timeline-header-day-cell-selected");
    }

    return classNames.join(" ");
}


function getTaskBarClassName(isSelected, isCut, isDelayed, isTaskDragPreviewTarget) {
    const classNames = ["task-bar"];

    if (isSelected) {
        classNames.push("task-bar-selected");
    }

    if (isCut) {
        classNames.push("task-bar-cut");
    }

    if (isDelayed) {
        classNames.push("task-bar-delayed");
    }

    if (isTaskDragPreviewTarget) {
        classNames.push("task-bar-drag-preview");
    }

    return classNames.join(" ");
}


function getDaySelectionMode(event) {
    return {
        isMultiSelect: event.ctrlKey || event.metaKey,
        isRangeSelect: event.shiftKey,
    };
}


function getDefaultSelectionMode() {
    return {
        isMultiSelect: false,
        isRangeSelect: false,
    };
}


function getTaskSelectionMode(event) {
    return {
        isMultiSelect: event.ctrlKey || event.metaKey,
        isRangeSelect: event.shiftKey,
    };
}


function getRectangleSelectionMode(event) {
    return {
        isMultiSelect: event.ctrlKey || event.metaKey,
        isRangeSelect: false,
    };
}


function getSelectedDayHighlights(selectedDates, metrics) {
    return selectedDates
        .map(function mapSelectedDate(dateString) {
            const layout = getDaySegmentLayout(parseDateString(dateString), metrics.gridCells);

            if (!layout) {
                return null;
            }

            return {
                key: `selected-${dateString}`,
                left: layout.left,
                width: layout.width,
            };
        })
        .filter(Boolean);
}


function getDayOffHighlights(dayOffs, tasks, metrics) {
    const highlights = [];

    dayOffs.forEach(function mapDayOff(dayOff) {
        const layout = getDaySegmentLayout(parseDateString(dayOff.date), metrics.gridCells);

        if (!layout) {
            return;
        }

        tasks.forEach(function mapTask(task, taskIndex) {
            if (!matchesDayOffAssignee(dayOff, task)) {
                return;
            }

            highlights.push({
                key: `${dayOff.id}-${task.id}`,
                left: layout.left,
                top: taskIndex * metrics.rowHeight,
                width: layout.width,
                height: metrics.rowHeight,
            });
        });
    });

    return highlights;
}


function getReleaseEventGroups(tasks, metrics, projectColorMap) {
    const eventGroups = [];
    const eventGroupMap = new Map();

    tasks.forEach(function mapTaskToReleaseEvent(task) {
        if (task.taskType !== RELEASE_TASK_TYPE) {
            return;
        }

        const eventDate = parseDateString(task.startDate);

        if (!isValidDate(eventDate)) {
            return;
        }

        const eventCellLayout = getTimelineCellLayout(eventDate, metrics.gridCells);

        if (!eventCellLayout) {
            return;
        }

        let eventGroup = eventGroupMap.get(eventCellLayout.key);

        if (!eventGroup) {
            const markerLeft = eventCellLayout.left + eventCellLayout.width / 2;

            eventGroup = {
                key: eventCellLayout.key,
                left: markerLeft,
                columnType: getEventMarkerColumnTypeAtOffset(markerLeft, metrics),
                events: [],
            };
            eventGroupMap.set(eventCellLayout.key, eventGroup);
            eventGroups.push(eventGroup);
        }

        eventGroup.events.push({
            id: task.id,
            name: task.name,
            backgroundColor: getReleaseEventFlagBackgroundColor(task, projectColorMap),
        });
    });

    return eventGroups;
}


function getReleaseEventFlagBackgroundColor(task, projectColorMap) {
    if (!task.projectName || task.projectName === NO_PROJECT_NAME) {
        return undefined;
    }

    return projectColorMap.get(task.projectName);
}


function getEventFlagStyle(eventItem) {
    if (!eventItem.backgroundColor) {
        return undefined;
    }

    return {
        "--planner-event-flag-background-color": eventItem.backgroundColor,
        "--planner-event-flag-text-color": getReadableEventFlagTextColor(
            eventItem.backgroundColor,
        ),
    };
}


function getReadableEventFlagTextColor(backgroundColor) {
    const backgroundLuminance = getHexColorLuminance(backgroundColor);

    if (backgroundLuminance === null) {
        return undefined;
    }

    const lightTextContrast = getContrastRatio(
        backgroundLuminance,
        getHexColorLuminance(EVENT_FLAG_LIGHT_TEXT_COLOR),
    );
    const darkTextContrast = getContrastRatio(
        backgroundLuminance,
        getHexColorLuminance(EVENT_FLAG_DARK_TEXT_COLOR),
    );

    if (darkTextContrast >= lightTextContrast) {
        return EVENT_FLAG_DARK_TEXT_COLOR;
    }

    return EVENT_FLAG_LIGHT_TEXT_COLOR;
}


function getContrastRatio(firstLuminance, secondLuminance) {
    const lighterLuminance = Math.max(firstLuminance, secondLuminance);
    const darkerLuminance = Math.min(firstLuminance, secondLuminance);

    return (
        (lighterLuminance + CONTRAST_RATIO_OFFSET)
        / (darkerLuminance + CONTRAST_RATIO_OFFSET)
    );
}


function getHexColorLuminance(hexColor) {
    const normalizedHexColor = hexColor.trim();

    if (!isFullHexColor(normalizedHexColor)) {
        return null;
    }

    const redChannel = getLinearRgbChannel(
        normalizedHexColor,
        HEX_RED_START_INDEX,
    );
    const greenChannel = getLinearRgbChannel(
        normalizedHexColor,
        HEX_GREEN_START_INDEX,
    );
    const blueChannel = getLinearRgbChannel(
        normalizedHexColor,
        HEX_BLUE_START_INDEX,
    );

    return (
        RED_LUMINANCE_WEIGHT * redChannel
        + GREEN_LUMINANCE_WEIGHT * greenChannel
        + BLUE_LUMINANCE_WEIGHT * blueChannel
    );
}


function isFullHexColor(hexColor) {
    if (hexColor.length !== HEX_COLOR_LENGTH) {
        return false;
    }

    return /^#[0-9A-Fa-f]{6}$/.test(hexColor);
}


function getLinearRgbChannel(hexColor, startIndex) {
    const channelHex = hexColor.slice(startIndex, startIndex + HEX_CHANNEL_LENGTH);
    const encodedChannel = parseInt(channelHex, HEX_COLOR_RADIX) / RGB_MAX_CHANNEL_VALUE;

    if (encodedChannel <= LINEAR_RGB_THRESHOLD) {
        return encodedChannel / LINEAR_RGB_DIVISOR;
    }

    return Math.pow(
        (encodedChannel + GAMMA_RGB_OFFSET) / GAMMA_RGB_DIVISOR,
        GAMMA_RGB_EXPONENT,
    );
}


function getProjectColorMap(projectNames) {
    return new Map(projectNames.map(function mapProjectColor(projectName) {
        return [projectName.name, projectName.backgroundColor];
    }));
}


function getEventMarkerColumnTypeAtOffset(markerLeft, metrics) {
    if (isTimelineOffsetInTodayColumn(markerLeft, metrics)) {
        return EVENT_MARKER_COLUMN_TODAY;
    }

    const markerDate = getTimelineDateAtOffset(markerLeft, metrics.gridCells).date;

    if (shouldShowWeekendShadows(metrics) && isWeekendDate(markerDate)) {
        return EVENT_MARKER_COLUMN_WEEKEND;
    }

    return EVENT_MARKER_COLUMN_NORMAL;
}


function getEventMarkerClassName(columnType) {
    const classNames = ["timeline-event-marker"];

    if (columnType === EVENT_MARKER_COLUMN_TODAY) {
        classNames.push("timeline-event-marker-today");
        return classNames.join(" ");
    }

    if (columnType === EVENT_MARKER_COLUMN_WEEKEND) {
        classNames.push("timeline-event-marker-weekend");
        return classNames.join(" ");
    }

    classNames.push("timeline-event-marker-normal");

    return classNames.join(" ");
}


function isTimelineOffsetInTodayColumn(offset, metrics) {
    if (!shouldShowTodayColumn(metrics)) {
        return false;
    }

    const todayLayout = getDaySegmentLayout(metrics.todayDate, metrics.gridCells);

    if (!todayLayout) {
        return false;
    }

    return offset >= todayLayout.left && offset <= todayLayout.left + todayLayout.width;
}


function matchesDayOffAssignee(dayOff, task) {
    if (dayOff.assignees.includes(DAY_OFF_ALL_ASSIGNEES)) {
        return true;
    }

    return dayOff.assignees.includes(getAssigneeLabel(task));
}


function getDaySegmentLayout(date, gridCells) {
    let offset = 0;

    for (const cell of gridCells) {
        if (isDateInCell(date, cell)) {
            const dayWidth = cell.width / cell.dayCount;
            const dayOffset = getDateDeltaDays(cell.startDate, date);

            return {
                left: offset + dayOffset * dayWidth,
                width: dayWidth,
            };
        }

        offset += cell.width;
    }

    return null;
}


function getTimelineCellLayout(date, gridCells) {
    let offset = 0;

    for (const cell of gridCells) {
        if (isDateInCell(date, cell)) {
            return {
                key: cell.key,
                left: offset,
                width: cell.width,
            };
        }

        offset += cell.width;
    }

    return null;
}


function getTimelineHeaderLayoutRows(headerRows) {
    return headerRows.map(function mapTimelineHeaderRow(headerRow) {
        const cells = getTimelineHeaderCells(headerRow);

        return {
            cells,
        };
    });
}


function getVisibleTimelineHeaderRows(headerLayoutRows, visibleTimelineRange) {
    return headerLayoutRows.map(function mapVisibleTimelineHeaderRow(headerLayoutRow) {
        const cells = getVisibleTimelineHeaderCells(
            headerLayoutRow.cells,
            visibleTimelineRange,
        );

        return {
            cells,
            gridLines: getTimelineHeaderGridLines(cells),
        };
    });
}


function getVisibleTimelineHeaderCells(headerCells, visibleTimelineRange) {
    return headerCells.filter(function matchVisibleHeaderCell(headerCell) {
        return (
            headerCell.right >= visibleTimelineRange.left
            && headerCell.left <= visibleTimelineRange.right
        );
    });
}


function getTimelineHeaderCells(headerRow) {
    let cellOffset = 0;

    return headerRow.map(function mapTimelineHeaderCell(segment) {
        const left = getPixelAlignedTimelineOffset(cellOffset);

        cellOffset += segment.width;

        const right = getPixelAlignedTimelineOffset(cellOffset);

        return {
            ...segment,
            left,
            right,
            width: Math.max(0, right - left),
        };
    });
}


function getTimelineHeaderGridLines(headerCells) {
    return headerCells.map(function mapTimelineHeaderGridLine(cell) {
        return {
            key: `header-grid-line-${cell.key}`,
            left: cell.right,
        };
    });
}


function getTimelineBackground(metrics, rowCount) {
    const bodyHeight = rowCount * metrics.rowHeight;
    const gridPaths = getTimelineGridPaths(metrics.gridCells, rowCount, metrics.rowHeight);

    return {
        bodyHeight,
        horizontalGridPath: gridPaths.horizontalGridPath,
        verticalGridPath: gridPaths.verticalGridPath,
        weekendHighlights: getWeekendHighlights(metrics, bodyHeight),
        todayHighlight: getTodayHighlight(metrics, bodyHeight),
    };
}


function getTimelineGridPaths(gridCells, rowCount, rowHeight) {
    const horizontalPathCommands = [];
    const verticalPathCommands = [];
    let cellOffset = 0;
    const timelineHeight = rowCount * rowHeight;

    gridCells.forEach(function mapGridCellToPath(cell) {
        cellOffset += cell.width;

        const lineLeft = getSvgGridLinePosition(cellOffset);
        verticalPathCommands.push(`M ${lineLeft} 0 V ${timelineHeight}`);
    });

    for (let rowIndex = 1; rowIndex <= rowCount; rowIndex += 1) {
        const lineTop = getSvgGridLinePosition(rowIndex * rowHeight);
        horizontalPathCommands.push(`M 0 ${lineTop} H ${cellOffset}`);
    }

    return {
        horizontalGridPath: horizontalPathCommands.join(" "),
        verticalGridPath: verticalPathCommands.join(" "),
    };
}


function getFixedEventBarLayout(panel) {
    const panelRect = panel.getBoundingClientRect();

    return {
        bottom: EVENT_BAR_SCREEN_BOTTOM_OFFSET_PIXELS,
        left: panelRect.left,
        width: panel.clientWidth,
    };
}


function hasSameFixedEventBarLayout(currentLayout, nextLayout) {
    return (
        currentLayout.bottom === nextLayout.bottom
        && currentLayout.left === nextLayout.left
        && currentLayout.width === nextLayout.width
    );
}


function getFixedEventBarTrackWidth(eventBarWidth) {
    return Math.max(0, eventBarWidth - EVENT_BAR_VIEWPORT_INSET_PIXELS * 2);
}


function getVisibleTimelineRange(panel, timelineWidth) {
    const rawRangeLeft = panel.scrollLeft - TIMELINE_HEADER_OVERSCAN_PIXELS;
    const rawRangeRight = (
        panel.scrollLeft
        + panel.clientWidth
        + TIMELINE_HEADER_OVERSCAN_PIXELS
    );
    const rangeLeft = Math.max(
        0,
        Math.floor(rawRangeLeft / TIMELINE_VISIBLE_RANGE_STEP_PIXELS)
            * TIMELINE_VISIBLE_RANGE_STEP_PIXELS,
    );
    const rangeRight = Math.ceil(rawRangeRight / TIMELINE_VISIBLE_RANGE_STEP_PIXELS)
        * TIMELINE_VISIBLE_RANGE_STEP_PIXELS;

    if (timelineWidth <= 0) {
        return {
            left: rangeLeft,
            right: Math.max(rangeLeft, rangeRight),
        };
    }

    const clampedRangeLeft = Math.min(rangeLeft, timelineWidth);

    return {
        left: clampedRangeLeft,
        right: Math.max(clampedRangeLeft, Math.min(rangeRight, timelineWidth)),
    };
}


function hasSameVisibleTimelineRange(currentRange, nextRange) {
    return currentRange.left === nextRange.left && currentRange.right === nextRange.right;
}


function getTodayHighlight(metrics, height) {
    const todayLayout = getDaySegmentLayout(metrics.todayDate, metrics.gridCells);

    if (!todayLayout) {
        return null;
    }

    if (shouldShowTodayColumn(metrics)) {
        const todaySegmentLayout = getPixelAlignedSegmentLayout(
            todayLayout.left,
            todayLayout.width,
        );

        return {
            mode: TODAY_HIGHLIGHT_MODE_COLUMN,
            height,
            left: todaySegmentLayout.left,
            width: todaySegmentLayout.width,
        };
    }

    return {
        mode: TODAY_HIGHLIGHT_MODE_LINE,
        height,
        left: getSvgTodayLinePosition(todayLayout.left + todayLayout.width / 2),
    };
}


function shouldShowTodayColumn(metrics) {
    return metrics.headerMode === DAY_HEADER_MODE || metrics.headerMode === WEEK_HEADER_MODE;
}


function isDateInCell(date, cell) {
    return date >= cell.startDate && date <= cell.stopDate;
}


function getWeekendHighlights(metrics, height) {
    if (!shouldShowWeekendShadows(metrics)) {
        return [];
    }

    const weekendHighlights = [];
    let cellOffset = 0;

    metrics.gridCells.forEach(function mapGridCellWeekendSegments(cell) {
        const dayWidth = cell.width / cell.dayCount;

        for (let dayOffset = 0; dayOffset < cell.dayCount; dayOffset += 1) {
            const date = addDays(cell.startDate, dayOffset);

            if (!isWeekendDate(date)) {
                continue;
            }

            const weekendSegmentLayout = getPixelAlignedSegmentLayout(
                cellOffset + dayOffset * dayWidth,
                dayWidth,
            );

            weekendHighlights.push({
                key: `${cell.key}-${dayOffset}`,
                height,
                left: weekendSegmentLayout.left,
                width: weekendSegmentLayout.width,
            });
        }

        cellOffset += cell.width;
    });

    return weekendHighlights;
}


function getPixelAlignedTimelineOffset(offset) {
    const devicePixelRatio = getDevicePixelRatio();

    return Math.round(offset * devicePixelRatio) / devicePixelRatio;
}


function getPixelAlignedSegmentLayout(left, width) {
    const alignedLeft = getPixelAlignedTimelineOffset(left);
    const alignedRight = getPixelAlignedTimelineOffset(left + width);

    return {
        left: alignedLeft,
        width: Math.max(0, alignedRight - alignedLeft),
    };
}


function getSvgGridLinePosition(offset) {
    return getPixelAlignedTimelineOffset(offset) + TIMELINE_GRID_LINE_WIDTH_PIXELS / 2;
}


function getSvgTodayLinePosition(offset) {
    return getPixelAlignedTimelineOffset(offset);
}


function getDevicePixelRatio() {
    if (typeof window === "undefined" || !window.devicePixelRatio) {
        return 1;
    }

    return window.devicePixelRatio;
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


function parseDateString(value) {
    const [year, month, day] = value.split("-").map(Number);

    return new Date(year, month - 1, day);
}


function isValidDate(date) {
    return date instanceof Date && !Number.isNaN(date.getTime());
}


function formatDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


function isTaskDelayed(task, todayDate) {
    const progressPercent = Number(task.progressPercent) || 0;

    if (progressPercent >= COMPLETED_PROGRESS_PERCENT) {
        return false;
    }

    if (!task.startDate || !task.stopDate || !isValidDate(todayDate)) {
        return false;
    }

    const startDate = parseDateString(task.startDate);
    const stopDate = parseDateString(task.stopDate);

    if (!isValidTaskDateRange(startDate, stopDate)) {
        return false;
    }

    const durationDays = getDateDeltaDays(startDate, stopDate) + 1;
    const elapsedDays = getDateDeltaDays(startDate, todayDate) + 1;

    if (
        durationDays < MINIMUM_TASK_DURATION_DAYS
        || elapsedDays <= NO_ELAPSED_TASK_DAYS
    ) {
        return false;
    }

    const expectedProgressDays = durationDays * (progressPercent / PERCENT_DIVISOR);

    return elapsedDays > expectedProgressDays;
}


function isValidTaskDateRange(startDate, stopDate) {
    return isValidDate(startDate)
        && isValidDate(stopDate)
        && stopDate >= startDate;
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


function isTimelinePanDrag(dragState) {
    return dragState.type === TIMELINE_DRAG_TYPE_PAN;
}


function isRectangleSelectionDrag(dragState) {
    return dragState.type === TIMELINE_DRAG_TYPE_RECTANGLE_SELECT;
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


function getTimelineSelectionPoint(panel, event, timelineWidth, headerHeight, bodyHeight) {
    const panelRect = panel.getBoundingClientRect();
    const viewportX = event.clientX - panelRect.left;
    const viewportY = event.clientY - panelRect.top;
    const timelineX = panel.scrollLeft + viewportX;
    const timelineY = panel.scrollTop + viewportY - headerHeight;

    return {
        x: getClampedValue(timelineX, 0, timelineWidth),
        y: getClampedValue(timelineY, 0, bodyHeight),
    };
}


function isTimelineScrollbarMouseDown(event, panel) {
    const panelRect = panel.getBoundingClientRect();
    const hasHorizontalScrollbar = panel.scrollWidth > panel.clientWidth;
    const hasVerticalScrollbar = panel.scrollHeight > panel.clientHeight;
    const isHorizontalScrollbarClick = (
        hasHorizontalScrollbar
        && event.clientY >= panelRect.top + panel.clientHeight
    );
    const isVerticalScrollbarClick = (
        hasVerticalScrollbar
        && event.clientX >= panelRect.left + panel.clientWidth
    );

    return isHorizontalScrollbarClick || isVerticalScrollbarClick;
}


function getTimelineDateAtPointer(panel, event, gridCells) {
    const panelRect = panel.getBoundingClientRect();
    const viewportOffset = event.clientX - panelRect.left;
    const timelineOffset = panel.scrollLeft + viewportOffset;

    return getTimelineDateAtOffset(timelineOffset, gridCells).date;
}


function getSelectionRectangle(startPoint, currentPoint) {
    const left = Math.min(startPoint.x, currentPoint.x);
    const top = Math.min(startPoint.y, currentPoint.y);
    const right = Math.max(startPoint.x, currentPoint.x);
    const bottom = Math.max(startPoint.y, currentPoint.y);

    return {
        left,
        top,
        width: right - left,
        height: bottom - top,
        right,
        bottom,
    };
}


function isLeftToRightSelection(startPoint, currentPoint) {
    return currentPoint.x >= startPoint.x;
}


function getRectangleSelectedTaskIds(bars, rectangle, isFullContainmentSelection) {
    return bars
        .filter(function matchRectangleSelectedTask(bar) {
            const taskBounds = getTaskBarSelectionBounds(bar);

            if (isFullContainmentSelection) {
                return isTaskBarFullyContained(taskBounds, rectangle);
            }

            return doesTaskBarIntersect(taskBounds, rectangle);
        })
        .map(function mapRectangleSelectedTaskId(bar) {
            return bar.task.id;
        });
}


function getTaskBarSelectionBounds(bar) {
    const taskBarVisualLayout = getTaskBarVisualLayout({
        left: bar.left,
        top: bar.top,
        width: bar.width,
    });

    return {
        left: taskBarVisualLayout.left,
        top: taskBarVisualLayout.top,
        right: taskBarVisualLayout.left + taskBarVisualLayout.width,
        bottom: taskBarVisualLayout.top + TASK_BAR_HEIGHT_PIXELS,
    };
}


function isTaskBarFullyContained(taskBounds, rectangle) {
    return (
        taskBounds.left >= rectangle.left
        && taskBounds.right <= rectangle.right
        && taskBounds.top >= rectangle.top
        && taskBounds.bottom <= rectangle.bottom
    );
}


function doesTaskBarIntersect(taskBounds, rectangle) {
    return (
        taskBounds.left <= rectangle.right
        && taskBounds.right >= rectangle.left
        && taskBounds.top <= rectangle.bottom
        && taskBounds.bottom >= rectangle.top
    );
}


function getClampedValue(value, minimumValue, maximumValue) {
    return Math.min(Math.max(value, minimumValue), maximumValue);
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
    if (dragState.isRowReorderDisabled) {
        return 0;
    }

    return Math.round((event.clientY - dragState.startClientY) / dragState.rowHeight);
}


function getTaskDragPreviewPixelDeltaY(dragState, event) {
    if (dragState.isRowReorderDisabled) {
        return 0;
    }

    return event.clientY - dragState.startClientY;
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


function getPanelCenterAnchor(panel, gridCells) {
    const viewportOffset = panel.clientWidth / 2;
    const timelineOffset = panel.scrollLeft + viewportOffset;
    const timelineDate = getTimelineDateAtOffset(timelineOffset, gridCells);

    return {
        ...timelineDate,
        viewportOffset,
    };
}


function setTimelinePanelDragging(panel, isDragging) {
    if (!panel) {
        return;
    }

    panel.classList.toggle("timeline-panel-dragging", isDragging);
}


function getTaskBarLayout(bar, taskDragPreview, isTaskDragPreviewTarget) {
    if (!taskDragPreview || !isTaskDragPreviewTarget) {
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
        left: bar.left,
        top: bar.top,
        width: bar.width,
    };
}


function getTaskBarTransform(taskDragPreview, isTaskDragPreviewTarget) {
    if (
        !taskDragPreview
        || !isTaskDragPreviewTarget
        || taskDragPreview.type !== TASK_DRAG_TYPE_MOVE
    ) {
        return undefined;
    }

    return getTaskBarMoveTransform(taskDragPreview.pixelDelta, taskDragPreview.pixelDeltaY);
}


function getTaskBarMoveTransform(pixelDelta, pixelDeltaY) {
    return `translate3d(${pixelDelta}px, ${pixelDeltaY}px, 0)`;
}


function getTaskHoverBubbleTransform(x, y) {
    return `translate3d(${x}px, ${y}px, 0) translateX(-50%)`;
}


function getTaskBarVisualLayout(taskBarLayout) {
    const horizontalInset = Math.min(
        TASK_BAR_HORIZONTAL_INSET_PIXELS,
        Math.max(0, (taskBarLayout.width - MIN_TASK_BAR_DISPLAY_WIDTH_PIXELS) / 2),
    );

    return {
        left: taskBarLayout.left + horizontalInset,
        top: taskBarLayout.top + TASK_BAR_VERTICAL_INSET_PIXELS,
        width: Math.max(
            taskBarLayout.width - horizontalInset * 2,
            MIN_TASK_BAR_DISPLAY_WIDTH_PIXELS,
        ),
    };
}


function shouldShowTaskBarLabel(taskName, taskBarWidth, canResizeTask) {
    return getTaskBarLabelWidth(taskName) <= getTaskBarLabelAvailableWidth(
        taskBarWidth,
        canResizeTask,
    );
}


function getTaskBarLabelAvailableWidth(taskBarWidth, canResizeTask) {
    const resizeHandleWidth = canResizeTask
        ? TASK_BAR_RESIZE_HANDLE_WIDTH_PIXELS * 2
        : 0;
    const reservedWidth = (
        TASK_BAR_LABEL_HORIZONTAL_PADDING_PIXELS * 2
        + resizeHandleWidth
    );

    return Math.max(0, taskBarWidth - reservedWidth);
}


function getTaskBarLabelWidth(taskName) {
    const cachedWidth = taskBarLabelWidthCache.get(taskName);

    if (cachedWidth !== undefined) {
        return cachedWidth;
    }

    const measureContext = getTaskBarLabelMeasureContext();

    if (!measureContext) {
        return Number.POSITIVE_INFINITY;
    }

    const measuredWidth = Math.ceil(measureContext.measureText(taskName).width);
    taskBarLabelWidthCache.set(taskName, measuredWidth);

    return measuredWidth;
}


function getTaskBarLabelMeasureContext() {
    if (taskBarLabelMeasureContext) {
        return taskBarLabelMeasureContext;
    }

    if (typeof document === "undefined") {
        return null;
    }

    const canvas = document.createElement("canvas");
    taskBarLabelMeasureContext = canvas.getContext("2d");

    if (taskBarLabelMeasureContext) {
        taskBarLabelMeasureContext.font = TASK_BAR_LABEL_FONT;
    }

    return taskBarLabelMeasureContext;
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


function getTaskRowHighlights(tasks, selectedTaskIds, highlightedTaskId) {
    const highlightedTaskIds = new Set(selectedTaskIds);

    if (highlightedTaskId) {
        highlightedTaskIds.add(highlightedTaskId);
    }

    return tasks
        .map(function mapTaskRowHighlight(task, index) {
            if (!highlightedTaskIds.has(task.id)) {
                return null;
            }

            return {
                taskId: task.id,
                index,
            };
        })
        .filter(Boolean);
}


function getWheelZoomDirection(event) {
    if (event.deltaY > 0) {
        return ZOOM_OUT_DIRECTION;
    }

    return ZOOM_IN_DIRECTION;
}


function shouldScrollTimelineHorizontally(event) {
    return event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY);
}


function getHorizontalWheelDelta(event) {
    if (event.deltaX !== 0) {
        return event.deltaX;
    }

    return event.deltaY;
}


function getTaskColor(task) {
    return getColorFromTaskType(task.taskType);
}


function scrollTimelineHorizontally(panel, deltaX) {
    if (deltaX === 0) {
        return;
    }

    panel.scrollLeft += deltaX;
}


function getColorFromTaskType(taskType) {
    return TASK_TYPE_COLORS[taskType] || DEFAULT_TASK_TYPE_COLOR;
}
