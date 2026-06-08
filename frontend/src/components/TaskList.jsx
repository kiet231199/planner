import { useEffect, useMemo, useState } from "react";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import FilterListIcon from "@mui/icons-material/FilterList";
import {
    Avatar,
    Box,
    Checkbox,
    IconButton,
    List,
    ListItemButton,
    ListItemText,
    Menu,
    MenuItem,
    Tooltip,
    Typography,
} from "@mui/material";

import { ROW_HEIGHT_PIXELS, getTimelineBodyRowCount } from "../utils/chartScale";


const UNASSIGNED_ASSIGNEE_LABEL = "Unassigned";
const EMPTY_ASSIGNEE_LABEL = "";
const UNASSIGNED_AVATAR_COLOR = "#d0d5dd";
const ASSIGNEE_SORT_NONE = "none";
const ASSIGNEE_SORT_ASCENDING = "ascending";
const ASSIGNEE_SORT_DESCENDING = "descending";
const ASSIGNEE_AVATAR_COLORS = [
    "#1e66f5",
    "#00a896",
    "#7c4dff",
    "#ef6c00",
    "#c2185b",
    "#00897b",
    "#5e35b1",
    "#d81b60",
];


export default function TaskList(props) {
    const {
        panelRef,
        tasks,
        assignees = [],
        assigneeFilterOptions = [],
        assigneeSortDirection,
        highlightedTaskId,
        isCollapsed = false,
        selectedAssigneeFilters = [],
        selectedTaskIds,
        headerHeight,
        onAssigneeFiltersClear,
        onAssigneeFilterToggle,
        onAssigneeSortToggle,
        onClearHighlight,
        onClearSelection,
        onHighlightTask,
        onPanelScroll,
        onResizeStart,
        onSelectTask,
    } = props;
    const [filterAnchorElement, setFilterAnchorElement] = useState(null);
    const [panelHeight, setPanelHeight] = useState(0);
    const isFilterMenuOpen = Boolean(filterAnchorElement);
    const isAssigneeFilterActive = selectedAssigneeFilters.length > 0;
    const assigneeColorMap = useMemo(function memoizeAssigneeColorMap() {
        return getAssigneeColorMap(assignees);
    }, [assignees]);
    const bodyRowCount = getTimelineBodyRowCount(
        tasks.length,
        panelHeight,
        headerHeight,
        ROW_HEIGHT_PIXELS,
    );
    const fillerRowHeight = Math.max(0, bodyRowCount - tasks.length) * ROW_HEIGHT_PIXELS;

    useEffect(function measureTaskListPanelHeight() {
        const panel = panelRef.current;

        if (!panel || typeof ResizeObserver === "undefined") {
            return undefined;
        }

        const resizeObserver = new ResizeObserver(function handlePanelResize() {
            setPanelHeight(panel.clientHeight);
        });

        setPanelHeight(panel.clientHeight);
        resizeObserver.observe(panel);

        return function disconnectResizeObserver() {
            resizeObserver.disconnect();
        };
    }, [panelRef, isCollapsed]);

    useEffect(function closeFilterMenuAfterCollapse() {
        if (!isCollapsed) {
            return;
        }

        setFilterAnchorElement(null);
    }, [isCollapsed]);

    function handleTaskListMouseDown(event) {
        if (event.target instanceof Element && event.target.closest(".task-list-row")) {
            return;
        }

        onClearHighlight();
        onClearSelection();
    }

    function handleTaskListHeaderMouseDown(event) {
        event.stopPropagation();
    }

    function handleResizeMouseDown(event) {
        event.stopPropagation();
        onResizeStart(event);
    }

    function handleAssigneeHeaderClick() {
        onAssigneeSortToggle();
    }

    function handleAssigneeHeaderKeyDown(event) {
        if (event.key !== "Enter" && event.key !== " ") {
            return;
        }

        event.preventDefault();
        onAssigneeSortToggle();
    }

    function handleFilterButtonMouseDown(event) {
        event.stopPropagation();
    }

    function handleFilterButtonKeyDown(event) {
        event.stopPropagation();
    }

    function handleFilterButtonClick(event) {
        event.stopPropagation();
        setFilterAnchorElement(event.currentTarget);
    }

    function handleFilterMenuClose() {
        setFilterAnchorElement(null);
    }

    function handleAssigneeFilterClick(assigneeLabel) {
        onAssigneeFilterToggle(assigneeLabel);
    }

    function handleAssigneeFiltersClear() {
        onAssigneeFiltersClear();
        handleFilterMenuClose();
    }

    function handleTaskSelection(event, task) {
        const selectionMode = getTaskSelectionMode(event);

        if (selectionMode.isMultiSelect || selectionMode.isRangeSelect) {
            onClearHighlight();
        } else {
            onHighlightTask(task.id);
        }

        onSelectTask(task.id, selectionMode, tasks);
    }

    if (isCollapsed) {
        return (
            <Box
                ref={panelRef}
                className={getTaskListPanelClassName(isCollapsed)}
                aria-hidden="true"
            />
        );
    }

    return (
        <Box
            ref={panelRef}
            className={getTaskListPanelClassName(isCollapsed)}
            onMouseDown={handleTaskListMouseDown}
            onScroll={onPanelScroll}
        >
            <Box
                className="task-list-header"
                sx={{ height: `${headerHeight}px` }}
                onMouseDown={handleTaskListHeaderMouseDown}
            >
                <Typography className="task-list-cell task-list-heading" component="div">
                    Task Name
                </Typography>
                <Box
                    className="task-list-cell task-list-heading task-list-assignee-heading"
                    role="button"
                    tabIndex={0}
                    aria-sort={getAssigneeSortAriaValue(assigneeSortDirection)}
                    onClick={handleAssigneeHeaderClick}
                    onKeyDown={handleAssigneeHeaderKeyDown}
                >
                    <Typography className="task-list-heading-label">
                        Assignee
                    </Typography>
                    {getAssigneeSortIcon(assigneeSortDirection)}
                    <Tooltip title="Filter by assignee">
                        <IconButton
                            size="small"
                            className="task-list-filter-button"
                            color={isAssigneeFilterActive ? "primary" : "default"}
                            aria-label="Filter by assignee"
                            aria-haspopup="menu"
                            aria-expanded={isFilterMenuOpen ? "true" : undefined}
                            onMouseDown={handleFilterButtonMouseDown}
                            onKeyDown={handleFilterButtonKeyDown}
                            onClick={handleFilterButtonClick}
                        >
                            <FilterListIcon fontSize="inherit" />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>
            <Menu
                anchorEl={filterAnchorElement}
                open={isFilterMenuOpen}
                onClose={handleFilterMenuClose}
                MenuListProps={{
                    className: "task-list-filter-menu",
                    "aria-label": "Assignee filters",
                }}
            >
                {assigneeFilterOptions.length === 0 && (
                    <MenuItem disabled>
                        <ListItemText primary="No assignees" />
                    </MenuItem>
                )}
                {assigneeFilterOptions.map(function renderAssigneeFilterOption(assigneeLabel) {
                    const isSelected = selectedAssigneeFilters.includes(assigneeLabel);

                    return (
                        <MenuItem
                            key={assigneeLabel}
                            onClick={function toggleAssigneeFilter() {
                                handleAssigneeFilterClick(assigneeLabel);
                            }}
                        >
                            <Checkbox checked={isSelected} />
                            <ListItemText primary={assigneeLabel} />
                        </MenuItem>
                    );
                })}
                {isAssigneeFilterActive && (
                    <MenuItem onClick={handleAssigneeFiltersClear}>
                        <ListItemText primary="Clear filter" />
                    </MenuItem>
                )}
            </Menu>
            <List disablePadding>
                {tasks.map(function renderTask(task) {
                    const isSelected = selectedTaskIds.includes(task.id);
                    const isHighlighted = highlightedTaskId === task.id || isSelected;
                    const rowClassName = getTaskListRowClassName(isHighlighted);
                    const assigneeLabel = getAssigneeLabel(task);
                    const avatarInitials = getAssigneeInitials(assigneeLabel);
                    const avatarTitle = getAssigneeAvatarTitle(assigneeLabel);

                    return (
                        <ListItemButton
                            key={task.id}
                            data-task-id={task.id}
                            disableRipple
                            selected={isSelected}
                            className={rowClassName}
                            onClick={function selectTask(event) {
                                handleTaskSelection(event, task);
                            }}
                        >
                            <Box className="task-list-cell task-list-name-cell">
                                {/* MUI Avatar keeps the assignee identity compact within the fixed task row height. */}
                                <Avatar
                                    className="task-assignee-avatar"
                                    title={avatarTitle}
                                    aria-label={avatarTitle}
                                    sx={{
                                        backgroundColor: getAssigneeAvatarColor(
                                            assigneeLabel,
                                            assigneeColorMap,
                                        ),
                                    }}
                                >
                                    {avatarInitials}
                                </Avatar>
                                <Typography className="task-list-name" title={task.name}>
                                    {task.name}
                                </Typography>
                            </Box>
                            <Box className="task-list-cell task-list-assignee-cell">
                                <Typography className="task-list-assignee" title={assigneeLabel}>
                                    {assigneeLabel}
                                </Typography>
                            </Box>
                        </ListItemButton>
                    );
                })}
            </List>
            {fillerRowHeight > 0 && (
                <Box
                    className="task-list-filler"
                    aria-hidden="true"
                    sx={{ height: `${fillerRowHeight}px` }}
                />
            )}
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


function getTaskListPanelClassName(isCollapsed) {
    if (isCollapsed) {
        return "task-list-panel task-list-panel-collapsed";
    }

    return "task-list-panel";
}


function getAssigneeSortIcon(assigneeSortDirection) {
    if (assigneeSortDirection === ASSIGNEE_SORT_ASCENDING) {
        return <ArrowUpwardIcon className="task-list-sort-icon" fontSize="inherit" />;
    }

    if (assigneeSortDirection === ASSIGNEE_SORT_DESCENDING) {
        return <ArrowDownwardIcon className="task-list-sort-icon" fontSize="inherit" />;
    }

    return null;
}


function getAssigneeSortAriaValue(assigneeSortDirection) {
    if (assigneeSortDirection === ASSIGNEE_SORT_ASCENDING) {
        return "ascending";
    }

    if (assigneeSortDirection === ASSIGNEE_SORT_DESCENDING) {
        return "descending";
    }

    return ASSIGNEE_SORT_NONE;
}


function getTaskSelectionMode(event) {
    return {
        isMultiSelect: event.ctrlKey || event.metaKey,
        isRangeSelect: event.shiftKey,
    };
}


function getTaskListRowClassName(isHovered) {
    if (isHovered) {
        return "task-list-row task-list-row-hovered";
    }

    return "task-list-row";
}


function getAssigneeLabel(task) {
    const assigneeLabel = task.assignee || EMPTY_ASSIGNEE_LABEL;
    const trimmedAssigneeLabel = assigneeLabel.trim();

    if (!trimmedAssigneeLabel) {
        return UNASSIGNED_ASSIGNEE_LABEL;
    }

    return trimmedAssigneeLabel;
}


function getAssigneeInitials(assigneeLabel) {
    if (assigneeLabel === UNASSIGNED_ASSIGNEE_LABEL) {
        return EMPTY_ASSIGNEE_LABEL;
    }

    const nameParts = assigneeLabel.split(/\s+/).filter(Boolean);
    const initials = nameParts.slice(0, 2).map(function getInitial(namePart) {
        return namePart.charAt(0).toUpperCase();
    });

    return initials.join(EMPTY_ASSIGNEE_LABEL);
}


function getAssigneeAvatarTitle(assigneeLabel) {
    if (assigneeLabel === UNASSIGNED_ASSIGNEE_LABEL) {
        return UNASSIGNED_ASSIGNEE_LABEL;
    }

    return `Assigned to ${assigneeLabel}`;
}


function getAssigneeAvatarColor(assigneeLabel, assigneeColorMap) {
    if (assigneeLabel === UNASSIGNED_ASSIGNEE_LABEL) {
        return UNASSIGNED_AVATAR_COLOR;
    }

    const configuredColor = assigneeColorMap.get(assigneeLabel);

    if (configuredColor) {
        return configuredColor;
    }

    const colorIndex = getAssigneeColorIndex(assigneeLabel);

    return ASSIGNEE_AVATAR_COLORS[colorIndex];
}


function getAssigneeColorIndex(assigneeLabel) {
    let characterTotal = 0;

    for (const character of assigneeLabel) {
        characterTotal += character.charCodeAt(0);
    }

    return characterTotal % ASSIGNEE_AVATAR_COLORS.length;
}


function getAssigneeColorMap(assignees) {
    return new Map(assignees.map(function mapAssigneeColor(assignee) {
        return [assignee.name, assignee.backgroundColor];
    }));
}
