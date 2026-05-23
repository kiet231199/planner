import { Box, LinearProgress } from "@mui/material";

import TaskDrawer from "./TaskDrawer";
import TaskList from "./TaskList";
import TaskToolbar from "./TaskToolbar";
import TimelineChart from "./TimelineChart";


export default function PlannerShell(props) {
    const {
        tasks,
        selectedTaskId,
        isDrawerOpen,
        isLoading,
        isSaving,
        zoomIndex,
        onAddTaskClick,
        onCreateTask,
        onDeleteSelectedTask,
        onDrawerClose,
        onSelectTask,
        onTimelineWheel,
    } = props;

    return (
        <Box className="planner-shell">
            <TaskToolbar
                hasSelectedTask={Boolean(selectedTaskId)}
                isSaving={isSaving}
                onAddTaskClick={onAddTaskClick}
                onDeleteSelectedTask={onDeleteSelectedTask}
            />
            {isLoading && <LinearProgress className="planner-progress" />}
            <Box className="planner-content">
                <TaskList
                    tasks={tasks}
                    selectedTaskId={selectedTaskId}
                    onSelectTask={onSelectTask}
                />
                <TimelineChart
                    tasks={tasks}
                    selectedTaskId={selectedTaskId}
                    zoomIndex={zoomIndex}
                    onSelectTask={onSelectTask}
                    onTimelineWheel={onTimelineWheel}
                />
            </Box>
            <TaskDrawer
                open={isDrawerOpen}
                isSaving={isSaving}
                onClose={onDrawerClose}
                onCreateTask={onCreateTask}
            />
        </Box>
    );
}
