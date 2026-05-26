import { Box, List, ListItemButton, Typography } from "@mui/material";

import { getDurationDays } from "../utils/chartScale";


export default function TaskList(props) {
    const {
        tasks,
        selectedTaskIds,
        headerHeight,
        onClearSelection,
        onSelectTask,
    } = props;

    function handleTaskListMouseDown(event) {
        if (event.target instanceof Element && event.target.closest(".task-list-row")) {
            return;
        }

        onClearSelection();
    }

    return (
        <Box className="task-list-panel" onMouseDown={handleTaskListMouseDown}>
            <Box className="task-list-header" sx={{ height: `${headerHeight}px` }}>
                <Typography className="task-list-cell task-list-heading">
                    Task Name
                </Typography>
                <Typography className="task-list-cell task-list-assignee">
                    Assignee
                </Typography>
                <Typography className="task-list-cell task-list-duration">
                    Days
                </Typography>
                <Typography className="task-list-cell task-list-progress">
                    Progress
                </Typography>
            </Box>
            {tasks.length === 0 ? (
                <Box className="empty-task-list">
                    <Typography variant="body2">
                        No tasks yet. Add one to start the plan.
                    </Typography>
                </Box>
            ) : (
                <List disablePadding>
                    {tasks.map(function renderTask(task) {
                        const isSelected = selectedTaskIds.includes(task.id);
                        const assigneeLabel = getAssigneeLabel(task);

                        return (
                            <ListItemButton
                                key={task.id}
                                selected={isSelected}
                                className="task-list-row"
                                onClick={function selectTask(event) {
                                    onSelectTask(task.id, event.ctrlKey || event.metaKey);
                                }}
                            >
                                <Box className="task-list-cell task-list-name-cell">
                                    <Box
                                        className="task-color-swatch"
                                        sx={{ backgroundColor: getTaskColor(task) }}
                                    />
                                    <Typography className="task-list-name" title={task.name}>
                                        {task.name}
                                    </Typography>
                                </Box>
                                <Typography
                                    className="task-list-cell task-list-assignee"
                                    title={assigneeLabel}
                                >
                                    {assigneeLabel}
                                </Typography>
                                <Typography className="task-list-cell task-list-duration">
                                    {getDurationDays(task)}
                                </Typography>
                                <Typography className="task-list-cell task-list-progress">
                                    {getProgressLabel(task)}
                                </Typography>
                            </ListItemButton>
                        );
                    })}
                </List>
            )}
        </Box>
    );
}


function getAssigneeLabel(task) {
    return task.assignee || "Unassigned";
}


function getProgressLabel(task) {
    return `${task.progressPercent}%`;
}


function getTaskColor(task) {
    return task.color || getColorFromTaskType(task.taskType);
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
