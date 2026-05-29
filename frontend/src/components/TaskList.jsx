import { Box, List, ListItemButton, Typography } from "@mui/material";


export default function TaskList(props) {
    const {
        panelRef,
        tasks,
        highlightedTaskId,
        selectedTaskIds,
        headerHeight,
        onClearHighlight,
        onClearSelection,
        onHighlightTask,
        onHoverTask,
        onHoverTaskEnd,
        onPanelScroll,
        onResizeStart,
        onSelectTask,
    } = props;

    function handleTaskListMouseDown(event) {
        if (event.target instanceof Element && event.target.closest(".task-list-row")) {
            return;
        }

        onClearHighlight();
        onClearSelection();
    }

    function handleResizeMouseDown(event) {
        event.stopPropagation();
        onResizeStart(event);
    }

    function handleTaskListMouseMove(event) {
        if (!(event.target instanceof Element)) {
            return;
        }

        const taskRow = event.target.closest(".task-list-row");

        if (!taskRow) {
            onHoverTaskEnd();
            return;
        }

        onHoverTask(taskRow.dataset.taskId);
    }

    return (
        <Box
            ref={panelRef}
            className="task-list-panel"
            onMouseDown={handleTaskListMouseDown}
            onMouseLeave={onHoverTaskEnd}
            onMouseMove={handleTaskListMouseMove}
            onScroll={onPanelScroll}
        >
            <Box className="task-list-header" sx={{ height: `${headerHeight}px` }}>
                <Typography className="task-list-cell task-list-heading">
                    Task Name
                </Typography>
            </Box>
            <List disablePadding>
                {tasks.map(function renderTask(task) {
                    const isSelected = selectedTaskIds.includes(task.id);
                    const isHovered = highlightedTaskId === task.id;
                    const rowClassName = getTaskListRowClassName(isHovered);

                    return (
                        <ListItemButton
                            key={task.id}
                            data-task-id={task.id}
                            disableRipple
                            selected={isSelected}
                            className={rowClassName}
                            onClick={function selectTask(event) {
                                onHighlightTask(task.id);
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


function getTaskListRowClassName(isHovered) {
    if (isHovered) {
        return "task-list-row task-list-row-hovered";
    }

    return "task-list-row";
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
