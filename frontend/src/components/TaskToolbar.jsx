import AddIcon from "@mui/icons-material/Add";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import EventBusyIcon from "@mui/icons-material/EventBusy";
import RedoIcon from "@mui/icons-material/Redo";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import TodayOutlinedIcon from "@mui/icons-material/TodayOutlined";
import UndoIcon from "@mui/icons-material/Undo";
import { Box, Button, IconButton, Tooltip, Typography } from "@mui/material";


export default function TaskToolbar(props) {
    const {
        canEditSelectedTask,
        canRedo,
        canUndo,
        hasSelectedDayOffDates,
        hasSelectedTask,
        isSaving,
        onAddTaskClick,
        onDayOffActionClick,
        onDeleteSelectedTask,
        onEditSelectedTask,
        onRedoTaskChange,
        onSettingsClick,
        onScrollTimelineFuture,
        onScrollTimelinePast,
        onScrollTimelineToday,
        onUndoTaskChange,
        selectedDatesHaveDayOff,
    } = props;
    const dayOffButtonLabel = selectedDatesHaveDayOff ? "Remove Day-off" : "Add Day-off";
    const DayOffButtonIcon = selectedDatesHaveDayOff ? EventBusyIcon : EventAvailableIcon;

    return (
        <Box component="header" className="task-toolbar">
            <Box className="toolbar-title-group">
                <Typography variant="h6" component="h1" className="toolbar-title">
                    Project Planner
                </Typography>
                <Box className="toolbar-timeline-navigation" aria-label="Timeline navigation">
                    <Tooltip title="Move timeline to the past">
                        <IconButton
                            className="toolbar-timeline-icon-button"
                            size="small"
                            aria-label="Move timeline to the past"
                            onClick={onScrollTimelinePast}
                        >
                            <ChevronLeftIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Button
                        className="toolbar-today-button"
                        variant="outlined"
                        startIcon={<TodayOutlinedIcon fontSize="small" />}
                        onClick={onScrollTimelineToday}
                    >
                        TODAY
                    </Button>
                    <Tooltip title="Move timeline to the future">
                        <IconButton
                            className="toolbar-timeline-icon-button"
                            size="small"
                            aria-label="Move timeline to the future"
                            onClick={onScrollTimelineFuture}
                        >
                            <ChevronRightIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Button
                        className="toolbar-day-off-button"
                        variant="outlined"
                        color={selectedDatesHaveDayOff ? "error" : "primary"}
                        startIcon={<DayOffButtonIcon fontSize="small" />}
                        disabled={!hasSelectedDayOffDates || isSaving}
                        onClick={onDayOffActionClick}
                    >
                        {dayOffButtonLabel}
                    </Button>
                </Box>
            </Box>
            <Box className="toolbar-actions">
                <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    disabled={isSaving}
                    onClick={onAddTaskClick}
                >
                    Add Task
                </Button>
                <Button
                    variant="outlined"
                    startIcon={<EditOutlinedIcon />}
                    disabled={!canEditSelectedTask || isSaving}
                    onClick={onEditSelectedTask}
                >
                    Edit
                </Button>
                <Button
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteOutlineIcon />}
                    disabled={!hasSelectedTask || isSaving}
                    onClick={onDeleteSelectedTask}
                >
                    Remove
                </Button>
                <Button
                    variant="outlined"
                    startIcon={<UndoIcon />}
                    disabled={!canUndo || isSaving}
                    onClick={onUndoTaskChange}
                >
                    Undo
                </Button>
                <Button
                    variant="outlined"
                    startIcon={<RedoIcon />}
                    disabled={!canRedo || isSaving}
                    onClick={onRedoTaskChange}
                >
                    Redo
                </Button>
                <Button
                    variant="outlined"
                    startIcon={<SettingsOutlinedIcon />}
                    onClick={onSettingsClick}
                >
                    Setting
                </Button>
            </Box>
        </Box>
    );
}
