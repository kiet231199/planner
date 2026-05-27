import { Box, LinearProgress } from "@mui/material";

import TaskDrawer from "./TaskDrawer";
import TaskList from "./TaskList";
import TaskToolbar from "./TaskToolbar";
import TimelineChart from "./TimelineChart";
import { getTimelineHeaderHeight } from "../utils/chartScale";


export default function PlannerShell(props) {
    const {
        tasks,
        selectedTaskId,
        selectedTaskIds,
        selectedTask,
        isDrawerOpen,
        isLoading,
        isSaving,
        canRedo,
        canUndo,
        canEditSelectedTask,
        drawerMode,
        zoomIndex,
        onAddTaskClick,
        onClearSelection,
        onCreateTask,
        onDeleteSelectedTask,
        onDrawerClose,
        onEditSelectedTask,
        onMoveTasks,
        onOpenTaskEdit,
        onRedoTaskChange,
        onResizeTaskDates,
        onSelectTask,
        onUndoTaskChange,
        onUpdateTask,
        onTimelineZoom,
    } = props;

    const timelineHeaderHeight = getTimelineHeaderHeight(zoomIndex);

    return (
        <Box className="planner-shell">
            <TaskToolbar
                hasSelectedTask={Boolean(selectedTaskId)}
                canEditSelectedTask={canEditSelectedTask}
                canRedo={canRedo}
                canUndo={canUndo}
                isSaving={isSaving}
                onAddTaskClick={onAddTaskClick}
                onDeleteSelectedTask={onDeleteSelectedTask}
                onEditSelectedTask={onEditSelectedTask}
                onRedoTaskChange={onRedoTaskChange}
                onUndoTaskChange={onUndoTaskChange}
            />
            {isLoading && <LinearProgress className="planner-progress" />}
            <Box className="planner-content">
                <TaskList
                    tasks={tasks}
                    selectedTaskIds={selectedTaskIds}
                    headerHeight={timelineHeaderHeight}
                    onClearSelection={onClearSelection}
                    onSelectTask={onSelectTask}
                />
                <TimelineChart
                    tasks={tasks}
                    isLoading={isLoading}
                    selectedTaskIds={selectedTaskIds}
                    zoomIndex={zoomIndex}
                    onClearSelection={onClearSelection}
                    onMoveTasks={onMoveTasks}
                    onOpenTaskEdit={onOpenTaskEdit}
                    onResizeTaskDates={onResizeTaskDates}
                    onSelectTask={onSelectTask}
                    onTimelineZoom={onTimelineZoom}
                />
            </Box>
            <TaskDrawer
                open={isDrawerOpen}
                isSaving={isSaving}
                mode={drawerMode}
                task={selectedTask}
                onClose={onDrawerClose}
                onCreateTask={onCreateTask}
                onUpdateTask={onUpdateTask}
            />
        </Box>
    );
}
