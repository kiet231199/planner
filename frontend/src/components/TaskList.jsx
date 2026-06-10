import { useEffect, useMemo, useRef, useState } from "react";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
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
import {
    TASK_LIST_SORT_ASCENDING,
    TASK_LIST_SORT_DESCENDING,
    TASK_LIST_SORT_NONE,
    getTaskAssigneeLabel,
    getTaskListColumnsMinimumWidth,
    getTaskListColumnDisplayValue,
} from "../utils/taskListColumns";


const UNASSIGNED_ASSIGNEE_LABEL = "Unassigned";
const EMPTY_ASSIGNEE_LABEL = "";
const UNASSIGNED_AVATAR_COLOR = "#d0d5dd";
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
const LEFT_MOUSE_BUTTON = 0;
const TASK_LIST_DRAG_THRESHOLD_PIXELS = 4;
const TASK_LIST_DRAG_TYPE_ROW_SELECT = "task-list-row-select";


export default function TaskList(props) {
    const {
        panelRef,
        tasks,
        allColumns = [],
        assignees = [],
        columnVisibility = {},
        columns = [],
        filterOptionsByColumn = {},
        highlightedTaskId,
        isCollapsed = false,
        selectedFiltersByColumn = {},
        selectedTaskIds,
        sortState,
        headerHeight,
        onColumnVisibilityToggle,
        onClearHighlight,
        onFilterToggle,
        onFiltersClear,
        onHighlightTask,
        onOpenTaskEdit,
        onPanelScroll,
        onAutoResize,
        onResizeStart,
        onSelectTask,
        onSelectTasks,
        onSortToggle,
    } = props;
    const dragStateRef = useRef(null);
    const suppressNextRowClickRef = useRef(false);
    const tasksRef = useRef(tasks);
    const onClearHighlightRef = useRef(onClearHighlight);
    const onSelectTasksRef = useRef(onSelectTasks);
    const [filterMenuState, setFilterMenuState] = useState({
        anchorElement: null,
        columnId: null,
    });
    const [columnMenuPosition, setColumnMenuPosition] = useState(null);
    const [panelHeight, setPanelHeight] = useState(0);
    const isFilterMenuOpen = Boolean(filterMenuState.anchorElement);
    const isColumnMenuOpen = Boolean(columnMenuPosition);
    const activeFilterColumn = columns.find(function matchFilterColumn(column) {
        return column.id === filterMenuState.columnId;
    }) || null;
    const activeFilterOptions = activeFilterColumn
        ? filterOptionsByColumn[activeFilterColumn.id] || []
        : [];
    const activeSelectedFilters = activeFilterColumn
        ? selectedFiltersByColumn[activeFilterColumn.id] || []
        : [];
    const gridTemplateColumns = getTaskListGridTemplateColumns(columns);
    const gridMinimumWidth = getTaskListColumnsMinimumWidth(columns);
    const taskListGridStyle = {
        gridTemplateColumns,
        minWidth: `${gridMinimumWidth}px`,
    };
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

    useEffect(function keepTaskListSelectionRefsCurrent() {
        tasksRef.current = tasks;
        onClearHighlightRef.current = onClearHighlight;
        onSelectTasksRef.current = onSelectTasks;
    }, [onClearHighlight, onSelectTasks, tasks]);

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

    useEffect(function closeMenusAfterCollapse() {
        if (!isCollapsed) {
            return;
        }

        setFilterMenuState({
            anchorElement: null,
            columnId: null,
        });
        setColumnMenuPosition(null);
    }, [isCollapsed]);

    useEffect(function repositionColumnMenuOnContextMenu() {
        if (!isColumnMenuOpen) {
            return undefined;
        }

        function handleDocumentContextMenu(event) {
            event.preventDefault();
            event.stopPropagation();
            setColumnMenuPosition({
                left: event.clientX,
                top: event.clientY,
            });
        }

        document.addEventListener("contextmenu", handleDocumentContextMenu, true);

        return function removeDocumentContextMenuListener() {
            document.removeEventListener("contextmenu", handleDocumentContextMenu, true);
        };
    }, [isColumnMenuOpen]);

    useEffect(function bindTaskListDragListeners() {
        function handleMouseMove(event) {
            const dragState = dragStateRef.current;

            if (!dragState) {
                return;
            }

            if (!isTaskListRowSelectionDrag(dragState)) {
                return;
            }

            updateTaskListRowSelectionPreview(dragState, event);
        }

        function handleMouseUp(event) {
            const dragState = dragStateRef.current;

            if (!dragState) {
                return;
            }

            if (isTaskListRowSelectionDrag(dragState)) {
                finishTaskListRowSelection(dragState, event);
            }
        }

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);

        return function removeTaskListDragListeners() {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, [headerHeight, panelRef]);

    function handleTaskListMouseDown(event) {
        if (event.target instanceof Element && event.target.closest(".task-list-row")) {
            return;
        }

        onClearHighlight();
        onSelectTasks([], getDefaultSelectionMode(), tasks);
    }

    function handleTaskListHeaderMouseDown(event) {
        event.stopPropagation();
    }

    function handleTaskListHeaderContextMenu(event) {
        event.preventDefault();
        event.stopPropagation();
        setColumnMenuPosition({
            left: event.clientX,
            top: event.clientY,
        });
    }

    function handleColumnMenuClose() {
        setColumnMenuPosition(null);
    }

    function handleColumnVisibilityClick(columnId) {
        onColumnVisibilityToggle(columnId);
    }

    function handleResizeMouseDown(event) {
        event.stopPropagation();

        if (event.detail > 1) {
            event.preventDefault();
            return;
        }

        onResizeStart(event);
    }

    function handleResizeDoubleClick(event) {
        event.preventDefault();
        event.stopPropagation();
        onAutoResize();
    }

    function handleHeaderCellClick(column) {
        if (!column.canSort) {
            return;
        }

        onSortToggle(column.id);
    }

    function handleHeaderCellKeyDown(event, column) {
        if (!column.canSort) {
            return;
        }

        if (event.key !== "Enter" && event.key !== " ") {
            return;
        }

        event.preventDefault();
        onSortToggle(column.id);
    }

    function handleFilterButtonMouseDown(event) {
        event.stopPropagation();
    }

    function handleFilterButtonKeyDown(event) {
        event.stopPropagation();
    }

    function handleFilterButtonClick(event, column) {
        event.stopPropagation();
        setFilterMenuState({
            anchorElement: event.currentTarget,
            columnId: column.id,
        });
    }

    function handleFilterMenuClose() {
        setFilterMenuState({
            anchorElement: null,
            columnId: null,
        });
    }

    function handleFilterClick(filterValue) {
        if (!activeFilterColumn) {
            return;
        }

        onFilterToggle(activeFilterColumn.id, filterValue);
    }

    function handleFiltersClear() {
        if (!activeFilterColumn) {
            return;
        }

        onFiltersClear(activeFilterColumn.id);
        handleFilterMenuClose();
    }

    function handleTaskRowMouseDown(event, task) {
        if (event.button !== LEFT_MOUSE_BUTTON) {
            return;
        }

        dragStateRef.current = {
            type: TASK_LIST_DRAG_TYPE_ROW_SELECT,
            panel: panelRef.current,
            startClientX: event.clientX,
            startClientY: event.clientY,
            startTaskId: task.id,
            currentTaskId: task.id,
            hasMoved: false,
        };
    }

    function handleTaskSelection(event, task) {
        if (suppressNextRowClickRef.current) {
            suppressNextRowClickRef.current = false;
            return;
        }

        const selectionMode = getTaskSelectionMode(event);

        if (selectionMode.isMultiSelect || selectionMode.isRangeSelect) {
            onClearHighlight();
        } else {
            onHighlightTask(task.id);
        }

        onSelectTask(task.id, selectionMode, tasks);
    }

    function handleTaskRowDoubleClick(event, task) {
        event.stopPropagation();
        onOpenTaskEdit(task.id);
    }

    function updateTaskListRowSelectionPreview(dragState, event) {
        const movement = getPointerMovement(dragState, event);

        if (!dragState.hasMoved && movement < TASK_LIST_DRAG_THRESHOLD_PIXELS) {
            return;
        }

        const currentTaskId = getTaskListTaskIdAtPointer(
            dragState.panel,
            event,
            tasksRef.current,
            headerHeight,
        );

        if (!currentTaskId) {
            return;
        }

        if (dragState.hasMoved && currentTaskId === dragState.currentTaskId) {
            return;
        }

        const selectedTaskIds = getTaskListRangeTaskIds(
            tasksRef.current,
            dragState.startTaskId,
            currentTaskId,
        );

        dragState.hasMoved = true;
        dragState.currentTaskId = currentTaskId;
        onClearHighlightRef.current();
        onSelectTasksRef.current(selectedTaskIds, getDefaultSelectionMode(), tasksRef.current);
    }

    function finishTaskListRowSelection(dragState, event) {
        const movement = getPointerMovement(dragState, event);
        const hasSelectedByDrag = dragState.hasMoved
            || movement >= TASK_LIST_DRAG_THRESHOLD_PIXELS;

        dragStateRef.current = null;

        if (!hasSelectedByDrag) {
            return;
        }

        updateTaskListRowSelectionPreview(dragState, event);
        suppressNextRowClickRef.current = true;
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
        <Box className={getTaskListPanelClassName(isCollapsed)}>
            <Box
                ref={panelRef}
                className="task-list-scroll-surface"
                sx={{
                    minWidth: `${gridMinimumWidth}px`,
                }}
                onMouseDown={handleTaskListMouseDown}
                onScroll={onPanelScroll}
            >
                <Box
                    className="task-list-header"
                    sx={{
                        height: `${headerHeight}px`,
                        ...taskListGridStyle,
                    }}
                    onMouseDown={handleTaskListHeaderMouseDown}
                    onContextMenu={handleTaskListHeaderContextMenu}
                >
                    {columns.map(function renderHeaderColumn(column) {
                        const isFilterActive = hasActiveFilter(
                            selectedFiltersByColumn,
                            column.id,
                        );

                        return (
                            <Box
                                key={column.id}
                                className={getHeaderCellClassName(column)}
                                role={column.canSort ? "button" : undefined}
                                tabIndex={column.canSort ? 0 : undefined}
                                aria-sort={getColumnSortAriaValue(column, sortState)}
                                onClick={function sortColumn() {
                                    handleHeaderCellClick(column);
                                }}
                                onKeyDown={function sortColumnWithKeyboard(event) {
                                    handleHeaderCellKeyDown(event, column);
                                }}
                            >
                                <Typography className="task-list-heading-label">
                                    {column.label}
                                </Typography>
                                {getColumnSortIcon(column, sortState)}
                                {column.canFilter && (
                                    <Tooltip
                                        title={`Filter by ${column.label.toLocaleLowerCase()}`}
                                    >
                                        <IconButton
                                            size="small"
                                            className="task-list-filter-button"
                                            color={isFilterActive ? "primary" : "default"}
                                            aria-label={`Filter by ${column.label}`}
                                            aria-haspopup="menu"
                                            aria-expanded={isFilterMenuOpen ? "true" : undefined}
                                            onMouseDown={handleFilterButtonMouseDown}
                                            onKeyDown={handleFilterButtonKeyDown}
                                            onClick={function openFilterMenu(event) {
                                                handleFilterButtonClick(event, column);
                                            }}
                                        >
                                            <FilterAltIcon fontSize="inherit" />
                                        </IconButton>
                                    </Tooltip>
                                )}
                            </Box>
                        );
                    })}
                </Box>
                <List disablePadding>
                    {tasks.map(function renderTask(task) {
                        const isSelected = selectedTaskIds.includes(task.id);
                        const isHighlighted = highlightedTaskId === task.id || isSelected;
                        const rowClassName = getTaskListRowClassName(isHighlighted);

                        return (
                            <ListItemButton
                                key={task.id}
                                data-task-id={task.id}
                                disableRipple
                                selected={isSelected}
                                className={rowClassName}
                                sx={taskListGridStyle}
                                onMouseDown={function startTaskRowSelection(event) {
                                    handleTaskRowMouseDown(event, task);
                                }}
                                onClick={function selectTask(event) {
                                    handleTaskSelection(event, task);
                                }}
                                onDoubleClick={function openTaskEdit(event) {
                                    handleTaskRowDoubleClick(event, task);
                                }}
                            >
                                {columns.map(function renderTaskColumn(column) {
                                    return (
                                        <TaskListCell
                                            key={column.id}
                                            task={task}
                                            column={column}
                                            assigneeColorMap={assigneeColorMap}
                                        />
                                    );
                                })}
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
            </Box>
            <Menu
                anchorEl={filterMenuState.anchorElement}
                open={isFilterMenuOpen}
                onClose={handleFilterMenuClose}
                MenuListProps={{
                    className: "task-list-filter-menu",
                    "aria-label": getFilterMenuAriaLabel(activeFilterColumn),
                }}
            >
                {activeFilterOptions.length === 0 && (
                    <MenuItem disabled>
                        <ListItemText primary={getEmptyFilterMessage(activeFilterColumn)} />
                    </MenuItem>
                )}
                {activeFilterOptions.map(function renderFilterOption(filterValue) {
                    const isSelected = activeSelectedFilters.includes(filterValue);

                    return (
                        <MenuItem
                            key={filterValue}
                            onClick={function toggleFilter() {
                                handleFilterClick(filterValue);
                            }}
                        >
                            <Checkbox checked={isSelected} />
                            <ListItemText primary={filterValue} />
                        </MenuItem>
                    );
                })}
                {activeSelectedFilters.length > 0 && (
                    <MenuItem onClick={handleFiltersClear}>
                        <ListItemText primary="Clear filter" />
                    </MenuItem>
                )}
            </Menu>
            <Menu
                anchorReference="anchorPosition"
                anchorPosition={columnMenuPosition}
                open={isColumnMenuOpen}
                onClose={handleColumnMenuClose}
                MenuListProps={{
                    className: "task-list-column-menu",
                    "aria-label": "Task list columns",
                }}
            >
                {allColumns.filter(function isHideableColumn(column) {
                    return column.canHide;
                }).map(function renderColumnMenuItem(column) {
                    const isVisible = Boolean(columnVisibility[column.id]);
                    const className = isVisible
                        ? "task-list-column-menu-item"
                        : "task-list-column-menu-item task-list-column-menu-item-hidden";

                    return (
                        <MenuItem
                            key={column.id}
                            className={className}
                            onClick={function toggleColumnVisibility() {
                                handleColumnVisibilityClick(column.id);
                            }}
                        >
                            <ListItemText primary={column.label} />
                        </MenuItem>
                    );
                })}
            </Menu>
            <Box
                className="task-list-resize-handle"
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize task list"
                onDoubleClick={handleResizeDoubleClick}
                onMouseDown={handleResizeMouseDown}
            />
        </Box>
    );
}


function TaskListCell(props) {
    const {
        assigneeColorMap,
        column,
        task,
    } = props;

    if (column.id === "name") {
        const assigneeLabel = getTaskAssigneeLabel(task);
        const avatarInitials = getAssigneeInitials(assigneeLabel);
        const avatarTitle = getAssigneeAvatarTitle(assigneeLabel);

        return (
            <Box className="task-list-cell task-list-name-cell">
                {/* MUI Avatar keeps task identity compact within the fixed task row height. */}
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
        );
    }

    const displayValue = getTaskListColumnDisplayValue(task, column.id);

    return (
        <Box className="task-list-cell task-list-value-cell">
            <Typography className="task-list-value" title={displayValue}>
                {displayValue}
            </Typography>
        </Box>
    );
}


function getTaskListGridTemplateColumns(columns) {
    return columns.map(function mapColumnWidth(column) {
        return column.width;
    }).join(" ");
}


function getTaskListPanelClassName(isCollapsed) {
    if (isCollapsed) {
        return "task-list-panel task-list-panel-collapsed";
    }

    return "task-list-panel";
}


function getHeaderCellClassName(column) {
    const classNames = ["task-list-cell", "task-list-heading"];

    if (column.canSort) {
        classNames.push("task-list-sortable-heading");
    }

    return classNames.join(" ");
}


function getColumnSortIcon(column, sortState) {
    if (sortState.columnId !== column.id) {
        return null;
    }

    if (sortState.direction === TASK_LIST_SORT_ASCENDING) {
        return <ArrowUpwardIcon className="task-list-sort-icon" fontSize="inherit" />;
    }

    if (sortState.direction === TASK_LIST_SORT_DESCENDING) {
        return <ArrowDownwardIcon className="task-list-sort-icon" fontSize="inherit" />;
    }

    return null;
}


function getColumnSortAriaValue(column, sortState) {
    if (sortState.columnId !== column.id) {
        return undefined;
    }

    if (sortState.direction === TASK_LIST_SORT_ASCENDING) {
        return "ascending";
    }

    if (sortState.direction === TASK_LIST_SORT_DESCENDING) {
        return "descending";
    }

    return TASK_LIST_SORT_NONE;
}


function hasActiveFilter(selectedFiltersByColumn, columnId) {
    const selectedFilters = selectedFiltersByColumn[columnId] || [];

    return selectedFilters.length > 0;
}


function getFilterMenuAriaLabel(activeFilterColumn) {
    if (!activeFilterColumn) {
        return "Task list filters";
    }

    return `${activeFilterColumn.label} filters`;
}


function getEmptyFilterMessage(activeFilterColumn) {
    if (!activeFilterColumn) {
        return "No values";
    }

    return `No ${activeFilterColumn.label.toLocaleLowerCase()} values`;
}


function getTaskSelectionMode(event) {
    return {
        isMultiSelect: event.ctrlKey || event.metaKey,
        isRangeSelect: event.shiftKey,
    };
}


function getDefaultSelectionMode() {
    return {
        isMultiSelect: false,
        isRangeSelect: false,
    };
}


function isTaskListRowSelectionDrag(dragState) {
    return dragState.type === TASK_LIST_DRAG_TYPE_ROW_SELECT;
}


function getPointerMovement(dragState, event) {
    return Math.max(
        Math.abs(event.clientX - dragState.startClientX),
        Math.abs(event.clientY - dragState.startClientY),
    );
}


function getTaskListTaskIdAtPointer(panel, event, tasks, headerHeight) {
    const pointedElement = document.elementFromPoint(event.clientX, event.clientY);
    const pointedRow = pointedElement instanceof Element
        ? pointedElement.closest(".task-list-row")
        : null;

    if (pointedRow) {
        return pointedRow.dataset.taskId || null;
    }

    if (!panel || tasks.length === 0 || !isPointerInsidePanel(panel, event)) {
        return null;
    }

    const panelRect = panel.getBoundingClientRect();
    const rowOffset = panel.scrollTop + event.clientY - panelRect.top - headerHeight;
    const rowIndex = Math.floor(rowOffset / ROW_HEIGHT_PIXELS);
    const clampedRowIndex = Math.min(Math.max(rowIndex, 0), tasks.length - 1);

    return tasks[clampedRowIndex].id;
}


function isPointerInsidePanel(panel, event) {
    const panelRect = panel.getBoundingClientRect();

    return (
        event.clientX >= panelRect.left
        && event.clientX <= panelRect.right
        && event.clientY >= panelRect.top
        && event.clientY <= panelRect.bottom
    );
}


function getTaskListRangeTaskIds(tasks, firstTaskId, secondTaskId) {
    const firstTaskIndex = tasks.findIndex(function matchFirstTask(task) {
        return task.id === firstTaskId;
    });
    const secondTaskIndex = tasks.findIndex(function matchSecondTask(task) {
        return task.id === secondTaskId;
    });

    if (firstTaskIndex < 0 || secondTaskIndex < 0) {
        return [secondTaskId];
    }

    const startIndex = Math.min(firstTaskIndex, secondTaskIndex);
    const stopIndex = Math.max(firstTaskIndex, secondTaskIndex);

    return tasks.slice(startIndex, stopIndex + 1).map(function mapRangeTaskId(task) {
        return task.id;
    });
}


function getTaskListRowClassName(isHovered) {
    if (isHovered) {
        return "task-list-row task-list-row-hovered";
    }

    return "task-list-row";
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
