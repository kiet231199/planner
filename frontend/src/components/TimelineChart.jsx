import { Box, Typography } from "@mui/material";

import { formatDateLabel, getTimelineMetrics } from "../utils/chartScale";


export default function TimelineChart(props) {
    const {
        tasks,
        selectedTaskId,
        zoomIndex,
        onSelectTask,
        onTimelineWheel,
    } = props;

    const metrics = getTimelineMetrics(tasks, zoomIndex);
    const chartHeight = metrics.headerHeight + Math.max(tasks.length, 1) * metrics.rowHeight;

    return (
        <Box className="timeline-panel" onWheel={onTimelineWheel}>
            <Box
                className="timeline-canvas"
                sx={{
                    width: `${metrics.timelineWidth}px`,
                    minHeight: `${chartHeight}px`,
                }}
            >
                <Box className="timeline-header" sx={{ height: `${metrics.headerHeight}px` }}>
                    {metrics.days.map(function renderDay(day) {
                        return (
                            <Box
                                key={day.toISOString()}
                                className="timeline-day-cell"
                                sx={{ width: `${metrics.dayWidth}px` }}
                            >
                                {formatDateLabel(day)}
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
                    {metrics.days.map(function renderGridColumn(day) {
                        return (
                            <Box
                                key={day.toISOString()}
                                className="timeline-grid-column"
                                sx={{ width: `${metrics.dayWidth}px` }}
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
                            className="timeline-empty-row"
                            sx={{ height: `${metrics.rowHeight}px` }}
                        >
                            <Typography variant="body2">
                                Timeline will appear here.
                            </Typography>
                        </Box>
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


function getTaskColor(task) {
    return getColorFromTaskType(task.taskType);
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
