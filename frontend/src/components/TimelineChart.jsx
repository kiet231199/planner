import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Box, Typography } from "@mui/material";

import {
    getTimelineDateAtOffset,
    getTimelineMetrics,
    getTimelineOffsetForDate,
} from "../utils/chartScale";


const DRAG_MOUSE_BUTTON = 0;
const ZOOM_IN_DIRECTION = 10;
const ZOOM_OUT_DIRECTION = -10;


export default function TimelineChart(props) {
    const {
        tasks,
        selectedTaskId,
        zoomIndex,
        onSelectTask,
        onTimelineZoom,
    } = props;

    const panelRef = useRef(null);
    const dragStateRef = useRef(null);
    const didSetInitialScrollRef = useRef(false);
    const metricsRef = useRef(null);
    const onTimelineZoomRef = useRef(onTimelineZoom);
    const pendingZoomAnchorRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);

    const metrics = getTimelineMetrics(tasks, zoomIndex);
    const chartHeight = metrics.headerHeight + Math.max(tasks.length, 1) * metrics.rowHeight;
    metricsRef.current = metrics;

    useEffect(function keepTimelineZoomHandlerCurrent() {
        onTimelineZoomRef.current = onTimelineZoom;
    }, [onTimelineZoom]);

    useLayoutEffect(function alignScrollWithTimelineScale() {
        const panel = panelRef.current;

        if (!panel) {
            return;
        }

        if (!didSetInitialScrollRef.current) {
            panel.scrollLeft = metrics.todayScrollLeft;
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
    }, [metrics]);

    useEffect(function bindDragListeners() {
        function handleMouseMove(event) {
            if (!dragStateRef.current) {
                return;
            }

            const panel = dragStateRef.current.panel;
            const dragDistance = event.clientX - dragStateRef.current.startClientX;
            panel.scrollLeft = dragStateRef.current.startScrollLeft - dragDistance;
        }

        function handleMouseUp() {
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
                    minHeight: `${chartHeight}px`,
                }}
            >
                <Box className="timeline-header" sx={{ height: `${metrics.headerHeight}px` }}>
                    {metrics.headerRows.map(function renderHeaderRow(headerRow, rowIndex) {
                        return (
                            <Box key={rowIndex} className="timeline-header-row">
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
                        minHeight: `${Math.max(tasks.length, 1) * metrics.rowHeight}px`,
                    }}
                >
                    {metrics.gridCells.map(function renderGridCell(cell) {
                        return (
                            <Box
                                key={cell.key}
                                className="timeline-grid-column"
                                sx={{ width: `${cell.width}px` }}
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
                    {tasks.length === 0 ? (
                        <Box
                            className="timeline-row-line"
                            sx={{ height: `${metrics.rowHeight}px` }}
                        />
                    ) : (
                        tasks.map(function renderRow(task) {
                            return (
                                <Box
                                    key={task.id}
                                    className="timeline-row-line"
                                    sx={{ height: `${metrics.rowHeight}px` }}
                                />
                            );
                        })
                    )}
                </Box>
                <Box
                    className="timeline-bars"
                    sx={{
                        top: `${metrics.headerHeight}px`,
                    }}
                >
                    {metrics.bars.map(function renderTaskBar(bar) {
                        const isSelected = bar.task.id === selectedTaskId;

                        return (
                            <Box
                                key={bar.task.id}
                                role="button"
                                tabIndex={0}
                                className={isSelected ? "task-bar task-bar-selected" : "task-bar"}
                                sx={{
                                    left: `${bar.left}px`,
                                    top: `${bar.top + 6}px`,
                                    width: `${bar.width}px`,
                                    backgroundColor: getTaskColor(bar.task),
                                }}
                                onClick={function selectTask() {
                                    onSelectTask(bar.task.id);
                                }}
                                onKeyDown={function handleTaskBarKeyDown(event) {
                                    if (event.key === "Enter" || event.key === " ") {
                                        onSelectTask(bar.task.id);
                                    }
                                }}
                            >
                                <Box
                                    className="task-bar-progress"
                                    sx={{
                                        width: `${bar.task.progressPercent}%`,
                                    }}
                                />
                                <Typography className="task-bar-label">
                                    {bar.task.name}
                                </Typography>
                            </Box>
                        );
                    })}
                </Box>
            </Box>
        </Box>
    );
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
