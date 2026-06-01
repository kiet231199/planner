import { useEffect, useRef, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import {
    Box,
    Button,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from "@mui/material";

import { DAY_OFF_ALL_ASSIGNEES, UNASSIGNED_ASSIGNEE } from "../constants/taskOptions";


const DEFAULT_NEW_ASSIGNEE_COLOR = "#1e88e5";
const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;
const RESERVED_ASSIGNEE_NAMES = new Set([
    UNASSIGNED_ASSIGNEE.toLocaleLowerCase(),
    DAY_OFF_ALL_ASSIGNEES.toLocaleLowerCase(),
]);


export default function AssigneeManagerDialog(props) {
    const {
        open,
        assignees = [],
        isSaving,
        onClose,
        onSave,
    } = props;
    const [draftRows, setDraftRows] = useState([]);
    const [selectedRowIds, setSelectedRowIds] = useState([]);
    const [rowErrors, setRowErrors] = useState({});
    const [pendingAssigneeUpdate, setPendingAssigneeUpdate] = useState(null);
    const rowIdCounterRef = useRef(0);
    const isAllSelected = (
        draftRows.length > 0
        && selectedRowIds.length === draftRows.length
    );
    const isPartiallySelected = (
        selectedRowIds.length > 0
        && selectedRowIds.length < draftRows.length
    );

    useEffect(function syncRowsWhenDialogOpens() {
        if (!open) {
            return;
        }

        setDraftRows(createDraftRows(assignees));
        setSelectedRowIds([]);
        setRowErrors({});
        setPendingAssigneeUpdate(null);
    }, [open, assignees]);

    function handleAddRow() {
        rowIdCounterRef.current += 1;

        setDraftRows(function addDraftRow(currentRows) {
            return [
                ...currentRows,
                {
                    rowId: `new-${rowIdCounterRef.current}`,
                    originalName: null,
                    name: "",
                    backgroundColor: DEFAULT_NEW_ASSIGNEE_COLOR,
                },
            ];
        });
    }

    function handleDeleteSelectedRows() {
        const selectedRowIdSet = new Set(selectedRowIds);

        setDraftRows(function deleteSelectedRows(currentRows) {
            return currentRows.filter(function keepDraftRow(row) {
                return !selectedRowIdSet.has(row.rowId);
            });
        });
        setSelectedRowIds([]);
        setRowErrors({});
    }

    function handleToggleAllRows() {
        if (isAllSelected) {
            setSelectedRowIds([]);
            return;
        }

        setSelectedRowIds(draftRows.map(function mapRowId(row) {
            return row.rowId;
        }));
    }

    function handleToggleRow(rowId) {
        setSelectedRowIds(function toggleSelectedRow(currentRowIds) {
            if (currentRowIds.includes(rowId)) {
                return currentRowIds.filter(function keepRowId(currentRowId) {
                    return currentRowId !== rowId;
                });
            }

            return [...currentRowIds, rowId];
        });
    }

    function handleDraftRowChange(rowId, fieldName, value) {
        setDraftRows(function updateDraftRows(currentRows) {
            return currentRows.map(function updateDraftRow(row) {
                if (row.rowId !== rowId) {
                    return row;
                }

                return {
                    ...row,
                    [fieldName]: value,
                };
            });
        });
    }

    async function handleSaveClick() {
        const nextRowErrors = validateDraftRows(draftRows);

        setRowErrors(nextRowErrors);

        if (hasValidationErrors(nextRowErrors)) {
            return;
        }

        const assigneeUpdate = getAssigneeUpdate(draftRows, assignees);

        if (hasReferenceImpact(assigneeUpdate)) {
            setPendingAssigneeUpdate(assigneeUpdate);
            return;
        }

        await saveAssignees(assigneeUpdate);
    }

    function handleWarningCancel() {
        setPendingAssigneeUpdate(null);
    }

    async function handleWarningConfirm() {
        if (!pendingAssigneeUpdate) {
            return;
        }

        await saveAssignees(pendingAssigneeUpdate);
    }

    async function saveAssignees(assigneeUpdate) {
        const saveResult = await onSave(assigneeUpdate);

        if (!saveResult) {
            return;
        }

        setPendingAssigneeUpdate(null);
        onClose();
    }

    return (
        <>
            <Dialog
                open={open}
                fullWidth
                maxWidth="md"
                onClose={isSaving ? undefined : onClose}
            >
                <DialogTitle>Manage assignees</DialogTitle>
                <DialogContent className="assignee-manager-content">
                    <Box className="assignee-manager-toolbar">
                        <Button
                            className="planner-action-button"
                            variant="outlined"
                            startIcon={<AddIcon />}
                            disabled={isSaving}
                            onClick={handleAddRow}
                        >
                            Add
                        </Button>
                        <Button
                            className="planner-action-button"
                            variant="outlined"
                            color="error"
                            startIcon={<DeleteOutlineIcon />}
                            disabled={isSaving || selectedRowIds.length === 0}
                            onClick={handleDeleteSelectedRows}
                        >
                            Delete
                        </Button>
                    </Box>
                    <Table
                        className="assignee-manager-table"
                        size="small"
                        aria-label="Assignee table"
                    >
                        <TableHead>
                            <TableRow>
                                <TableCell className="assignee-selection-cell" padding="checkbox">
                                    <Checkbox
                                        checked={isAllSelected}
                                        indeterminate={isPartiallySelected}
                                        disabled={draftRows.length === 0}
                                        inputProps={{ "aria-label": "Select all assignees" }}
                                        onChange={handleToggleAllRows}
                                    />
                                </TableCell>
                                <TableCell>Name</TableCell>
                                <TableCell className="assignee-color-cell">Color</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {draftRows.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={3}>
                                        <Typography color="text.secondary">
                                            No assignees
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            )}
                            {draftRows.map(function renderDraftRow(row) {
                                const errors = rowErrors[row.rowId] || {};

                                return (
                                    <TableRow key={row.rowId}>
                                        <TableCell
                                            className="assignee-selection-cell"
                                            padding="checkbox"
                                        >
                                            <Checkbox
                                                checked={selectedRowIds.includes(row.rowId)}
                                                inputProps={{
                                                    "aria-label": `Select ${row.name || "assignee"}`,
                                                }}
                                                onChange={function toggleRow() {
                                                    handleToggleRow(row.rowId);
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <TextField
                                                value={row.name}
                                                size="small"
                                                fullWidth
                                                error={Boolean(errors.name)}
                                                helperText={errors.name}
                                                onChange={function updateName(event) {
                                                    handleDraftRowChange(
                                                        row.rowId,
                                                        "name",
                                                        event.target.value,
                                                    );
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell className="assignee-color-cell">
                                            <TextField
                                                value={row.backgroundColor}
                                                type="color"
                                                size="small"
                                                className="assignee-color-input"
                                                error={Boolean(errors.backgroundColor)}
                                                helperText={errors.backgroundColor}
                                                onChange={function updateColor(event) {
                                                    handleDraftRowChange(
                                                        row.rowId,
                                                        "backgroundColor",
                                                        event.target.value,
                                                    );
                                                }}
                                            />
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </DialogContent>
                <DialogActions>
                    <Button
                        className="planner-action-button"
                        variant="outlined"
                        disabled={isSaving}
                        onClick={onClose}
                    >
                        Cancel
                    </Button>
                    <Button
                        className="planner-action-button"
                        variant="contained"
                        disabled={isSaving}
                        onClick={handleSaveClick}
                    >
                        Save
                    </Button>
                </DialogActions>
            </Dialog>
            <Dialog
                open={Boolean(pendingAssigneeUpdate)}
                onClose={isSaving ? undefined : handleWarningCancel}
            >
                <DialogTitle>Update assignee references?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Referenced tasks and day-offs will be affected by this assignee change.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button
                        className="planner-action-button"
                        variant="outlined"
                        color="error"
                        disabled={isSaving}
                        onClick={handleWarningCancel}
                    >
                        No
                    </Button>
                    <Button
                        className="planner-action-button"
                        variant="contained"
                        color="error"
                        disabled={isSaving}
                        onClick={handleWarningConfirm}
                    >
                        Yes
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}


function createDraftRows(assignees) {
    return assignees.map(function mapAssignee(assignee, index) {
        return {
            rowId: `existing-${index}-${assignee.name}`,
            originalName: assignee.name,
            name: assignee.name,
            backgroundColor: assignee.backgroundColor,
        };
    });
}


function validateDraftRows(draftRows) {
    const nameCounts = getDraftNameCounts(draftRows);
    const errors = {};

    draftRows.forEach(function validateDraftRow(row) {
        const rowError = {};
        const trimmedName = row.name.trim();
        const trimmedColor = row.backgroundColor.trim();

        if (!trimmedName) {
            rowError.name = "Name is required.";
        } else if (RESERVED_ASSIGNEE_NAMES.has(trimmedName.toLocaleLowerCase())) {
            rowError.name = "Name is reserved.";
        } else if (nameCounts.get(trimmedName.toLocaleLowerCase()) > 1) {
            rowError.name = "Name must be unique.";
        }

        if (!HEX_COLOR_PATTERN.test(trimmedColor)) {
            rowError.backgroundColor = "Use #RRGGBB.";
        }

        if (Object.keys(rowError).length > 0) {
            errors[row.rowId] = rowError;
        }
    });

    return errors;
}


function getDraftNameCounts(draftRows) {
    const nameCounts = new Map();

    draftRows.forEach(function countDraftName(row) {
        const trimmedName = row.name.trim();

        if (!trimmedName) {
            return;
        }

        const nameKey = trimmedName.toLocaleLowerCase();
        const currentCount = nameCounts.get(nameKey) || 0;

        nameCounts.set(nameKey, currentCount + 1);
    });

    return nameCounts;
}


function hasValidationErrors(rowErrors) {
    return Object.keys(rowErrors).length > 0;
}


function getAssigneeUpdate(draftRows, originalAssignees) {
    const normalizedRows = draftRows.map(function normalizeDraftRow(row) {
        return {
            originalName: row.originalName,
            name: row.name.trim(),
            backgroundColor: row.backgroundColor.trim(),
        };
    });
    const assignees = normalizedRows.map(function mapAssignee(row) {
        return {
            name: row.name,
            backgroundColor: row.backgroundColor,
        };
    });
    const activeOriginalNames = new Set(
        normalizedRows
            .filter(function hasOriginalName(row) {
                return Boolean(row.originalName);
            })
            .map(function mapOriginalName(row) {
                return row.originalName;
            }),
    );
    const nextAssigneeNames = new Set(assignees.map(function mapAssigneeName(assignee) {
        return assignee.name;
    }));
    const renamedAssignees = normalizedRows
        .filter(function isRenamedAssignee(row) {
            return row.originalName && row.originalName !== row.name;
        })
        .map(function mapRenamedAssignee(row) {
            return {
                previousName: row.originalName,
                nextName: row.name,
            };
        });
    const deletedAssignees = originalAssignees
        .map(function mapOriginalAssigneeName(assignee) {
            return assignee.name;
        })
        .filter(function isDeletedAssignee(assigneeName) {
            return !activeOriginalNames.has(assigneeName)
                && !nextAssigneeNames.has(assigneeName);
        });

    return {
        assignees,
        renamedAssignees,
        deletedAssignees,
    };
}


function hasReferenceImpact(assigneeUpdate) {
    return assigneeUpdate.renamedAssignees.length > 0
        || assigneeUpdate.deletedAssignees.length > 0;
}
