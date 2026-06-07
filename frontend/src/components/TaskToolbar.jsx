import AddIcon from "@mui/icons-material/Add";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import ContentCutOutlinedIcon from "@mui/icons-material/ContentCutOutlined";
import ContentPasteOutlinedIcon from "@mui/icons-material/ContentPasteOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import EventBusyIcon from "@mui/icons-material/EventBusy";
import KeyboardTabIcon from "@mui/icons-material/KeyboardTab";
import RedoIcon from "@mui/icons-material/Redo";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import TodayOutlinedIcon from "@mui/icons-material/TodayOutlined";
import UndoIcon from "@mui/icons-material/Undo";
import {
    Box,
    Button,
    IconButton,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
} from "@mui/material";

import { TIMELINE_ZOOM_MODES } from "../utils/chartScale";


export default function TaskToolbar(props) {
    const {
        canEditSelectedTask,
        canCopySelectedTasks,
        canCutSelectedTasks,
        canPasteCopiedTasks,
        canRedo,
        canUndo,
        hasSelectedDayOffDates,
        hasSelectedTask,
        isTaskListCollapsed,
        isSaving,
        onAddTaskClick,
        onDayOffActionClick,
        onDeleteSelectedTask,
        onEditSelectedTask,
        onCopySelectedTasks,
        onCutSelectedTasks,
        onPasteCopiedTasks,
        onRefreshPlanner,
        onRedoTaskChange,
        onSettingsClick,
        onScrollTimelineFuture,
        onScrollTimelinePast,
        onScrollTimelineToday,
        onTimelineZoomModeChange,
        onTaskListCollapseToggle,
        onUndoTaskChange,
        selectedDatesHaveDayOff,
        zoomMode,
    } = props;
    const dayOffButtonLabel = selectedDatesHaveDayOff ? "Remove Day-off" : "Add Day-off";
    const DayOffButtonIcon = selectedDatesHaveDayOff ? EventBusyIcon : EventAvailableIcon;
    const taskListCollapseButtonLabel = getTaskListCollapseButtonLabel(isTaskListCollapsed);

    function handleZoomModeChange(_, nextZoomMode) {
        if (!nextZoomMode) {
            return;
        }

        onTimelineZoomModeChange(nextZoomMode);
    }

    return (
        <>
            <Box
                component="nav"
                className="toolbar-panel"
                aria-label="Planner actions"
            >
                <Box className="toolbar-panel-main-actions">
                    <ToolbarIconButton
                        label="Add task"
                        disabled={isSaving}
                        onClick={onAddTaskClick}
                    >
                        <AddIcon />
                    </ToolbarIconButton>
                    <ToolbarIconButton
                        label="Edit"
                        disabled={!canEditSelectedTask || isSaving}
                        onClick={onEditSelectedTask}
                    >
                        <EditOutlinedIcon />
                    </ToolbarIconButton>
                    <ToolbarIconButton
                        label="Copy"
                        disabled={!canCopySelectedTasks}
                        onClick={onCopySelectedTasks}
                    >
                        <ContentCopyOutlinedIcon />
                    </ToolbarIconButton>
                    <ToolbarIconButton
                        label="Cut"
                        disabled={!canCutSelectedTasks}
                        onClick={onCutSelectedTasks}
                    >
                        <ContentCutOutlinedIcon />
                    </ToolbarIconButton>
                    <ToolbarIconButton
                        label="Paste"
                        disabled={!canPasteCopiedTasks}
                        onClick={onPasteCopiedTasks}
                    >
                        <ContentPasteOutlinedIcon />
                    </ToolbarIconButton>
                    <ToolbarIconButton
                        label="Remove"
                        color="error"
                        disabled={!hasSelectedTask || isSaving}
                        onClick={onDeleteSelectedTask}
                    >
                        <DeleteOutlineIcon />
                    </ToolbarIconButton>
                    <ToolbarIconButton
                        label="Undo"
                        disabled={!canUndo || isSaving}
                        onClick={onUndoTaskChange}
                    >
                        <UndoIcon />
                    </ToolbarIconButton>
                    <ToolbarIconButton
                        label="Redo"
                        disabled={!canRedo || isSaving}
                        onClick={onRedoTaskChange}
                    >
                        <RedoIcon />
                    </ToolbarIconButton>
                    <ToolbarIconButton
                        label={dayOffButtonLabel}
                        color={selectedDatesHaveDayOff ? "error" : "primary"}
                        disabled={!hasSelectedDayOffDates || isSaving}
                        onClick={onDayOffActionClick}
                    >
                        <DayOffButtonIcon />
                    </ToolbarIconButton>
                </Box>
                <Box className="toolbar-panel-bottom-actions">
                    <ToolbarIconButton
                        label={taskListCollapseButtonLabel}
                        onClick={onTaskListCollapseToggle}
                    >
                        {getTaskListCollapseIcon(isTaskListCollapsed)}
                    </ToolbarIconButton>
                    <ToolbarIconButton
                        label="Setting"
                        onClick={onSettingsClick}
                    >
                        <SettingsOutlinedIcon />
                    </ToolbarIconButton>
                </Box>
            </Box>
            <Box component="header" className="task-toolbar">
                <Box component="h1" className="toolbar-title-heading">
                    <Button
                        className="toolbar-title-button"
                        variant="text"
                        onClick={onRefreshPlanner}
                    >
                        Project Planner
                    </Button>
                </Box>
                <Box className="toolbar-timeline-navigation" aria-label="Timeline navigation">
                    <ToggleButtonGroup
                        className="toolbar-zoom-mode-group"
                        size="small"
                        color="primary"
                        exclusive
                        value={zoomMode}
                        aria-label="Timeline zoom mode"
                        onChange={handleZoomModeChange}
                    >
                        {TIMELINE_ZOOM_MODES.map(function renderZoomModeButton(zoomModeOption) {
                            return (
                                <ToggleButton
                                    key={zoomModeOption.value}
                                    className="toolbar-zoom-mode-button"
                                    value={zoomModeOption.value}
                                    aria-label={`${zoomModeOption.label} mode`}
                                >
                                    {zoomModeOption.label}
                                </ToggleButton>
                            );
                        })}
                    </ToggleButtonGroup>
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
                </Box>
            </Box>
        </>
    );
}


function ToolbarIconButton(props) {
    const {
        children,
        color = "primary",
        disabled = false,
        label,
        onClick,
    } = props;

    return (
        <Tooltip
            title={label}
            placement="right"
            slotProps={{
                tooltip: {
                    className: "toolbar-panel-tooltip",
                },
            }}
        >
            <span className="toolbar-panel-button-wrapper">
                <IconButton
                    className="toolbar-panel-button"
                    color={color}
                    disabled={disabled}
                    aria-label={label}
                    onClick={onClick}
                >
                    {children}
                </IconButton>
            </span>
        </Tooltip>
    );
}


function getTaskListCollapseButtonLabel(isTaskListCollapsed) {
    if (isTaskListCollapsed) {
        return "Expand task list";
    }

    return "Collapse task list";
}


function getTaskListCollapseIcon(isTaskListCollapsed) {
    if (isTaskListCollapsed) {
        return <KeyboardTabIcon fontSize="small" />;
    }

    return <KeyboardTabIcon className="task-list-collapse-icon-left" fontSize="small" />;
}
