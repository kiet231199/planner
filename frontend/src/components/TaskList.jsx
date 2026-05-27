import { Box, List, ListItemButton, Typography } from "@mui/material";


export default function TaskList(props) {
    const {
        tasks,
        selectedTaskIds,
        headerHeight,
        onClearSelection,
        onResizeStart,
        onSelectTask,
    } = props;

    function handleTaskListMouseDown(event) {
        if (event.target instanceof Element && event.target.closest(".task-list-row")) {
            return;
        }

        onClearSelection();
    }

    function handleResizeMouseDown(event) {
        event.stopPropagation();
        onResizeStart(event);
    }

    return (
        <Box className="task-list-panel" onMouseDown={handleTaskListMouseDown}>
            <Box className="task-list-header" sx={{ height: `${headerHeight}px` }}>
                <Typography className="task-list-cell task-list-heading">
                    Task Name
                </Typography>
            </Box>
            <List disablePadding>
                {tasks.map(function renderTask(task) {
                    const isSelected = selectedTaskIds.includes(task.id);

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
                        </ListItemButton>
                    );
                })}
            </List>
            <Box
                className="task-list-resize-handle"
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize task list"
                onMouseDown={handleResizeMouseDown}
            />
        </Box>
    );
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
