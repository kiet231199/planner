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


const DEFAULT_NEW_ITEM_COLOR = "#1e88e5";
const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;


export default function NameColorManagerDialog(props) {
    const {
        open,
        items = [],
        isSaving,
        labels,
        reservedNames = new Set(),
        updateKeys,
        onClose,
        onSave,
    } = props;
    const [draftRows, setDraftRows] = useState([]);
    const [selectedRowIds, setSelectedRowIds] = useState([]);
    const [rowErrors, setRowErrors] = useState({});
    const [pendingUpdate, setPendingUpdate] = useState(null);
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

        setDraftRows(createDraftRows(items));
        setSelectedRowIds([]);
        setRowErrors({});
        setPendingUpdate(null);
    }, [open, items]);

    function handleAddRow() {
        rowIdCounterRef.current += 1;

        setDraftRows(function addDraftRow(currentRows) {
            return [
                ...currentRows,
                {
                    rowId: `new-${rowIdCounterRef.current}`,
                    originalName: null,
                    name: "",
                    backgroundColor: getNewItemColor(currentRows, labels),
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
        const nextRowErrors = validateDraftRows(draftRows, reservedNames);

        setRowErrors(nextRowErrors);

        if (hasValidationErrors(nextRowErrors)) {
            return;
        }

        const itemUpdate = getItemUpdate(draftRows, items, updateKeys);

        if (hasReferenceImpact(itemUpdate, updateKeys)) {
            setPendingUpdate(itemUpdate);
            return;
        }

        await saveItems(itemUpdate);
    }

    function handleWarningCancel() {
        setPendingUpdate(null);
    }

    async function handleWarningConfirm() {
        if (!pendingUpdate) {
            return;
        }

        await saveItems(pendingUpdate);
    }

    async function saveItems(itemUpdate) {
        const saveResult = await onSave(itemUpdate);

        if (!saveResult) {
            return;
        }

        setPendingUpdate(null);
        onClose();
    }

    return (
        <>
            <Dialog
                open={open}
                fullWidth
                maxWidth="md"
                PaperProps={{ className: "name-color-manager-dialog-paper" }}
                onClose={isSaving ? undefined : onClose}
            >
                <DialogTitle>{labels.title}</DialogTitle>
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
                        aria-label={labels.tableAriaLabel}
                    >
                        <TableHead>
                            <TableRow>
                                <TableCell className="assignee-selection-cell" padding="checkbox">
                                    <Checkbox
                                        checked={isAllSelected}
                                        indeterminate={isPartiallySelected}
                                        disabled={draftRows.length === 0}
                                        inputProps={{ "aria-label": labels.selectAllAriaLabel }}
                                        onChange={handleToggleAllRows}
                                    />
                                </TableCell>
                                <TableCell>{labels.nameColumn}</TableCell>
                                <TableCell className="assignee-color-cell">Color</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {draftRows.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={3}>
                                        <Typography color="text.secondary">
                                            {labels.emptyMessage}
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
                                                    "aria-label": labels.getRowSelectAriaLabel(
                                                        row.name,
                                                    ),
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
                open={Boolean(pendingUpdate)}
                onClose={isSaving ? undefined : handleWarningCancel}
            >
                <DialogTitle>{labels.warningTitle}</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {labels.warningMessage}
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


function createDraftRows(items) {
    return items.map(function mapItem(item, index) {
        return {
            rowId: `existing-${index}-${item.name}`,
            originalName: item.name,
            name: item.name,
            backgroundColor: item.backgroundColor,
        };
    });
}


function getNewItemColor(currentRows, labels) {
    if (labels.getDefaultNewColor) {
        return labels.getDefaultNewColor(currentRows);
    }

    return labels.defaultNewColor || DEFAULT_NEW_ITEM_COLOR;
}


function validateDraftRows(draftRows, reservedNames) {
    const nameCounts = getDraftNameCounts(draftRows);
    const errors = {};

    draftRows.forEach(function validateDraftRow(row) {
        const rowError = {};
        const trimmedName = row.name.trim();
        const trimmedColor = row.backgroundColor.trim();

        if (!trimmedName) {
            rowError.name = "Name is required.";
        } else if (reservedNames.has(trimmedName.toLocaleLowerCase())) {
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


function getItemUpdate(draftRows, originalItems, updateKeys) {
    const normalizedRows = draftRows.map(function normalizeDraftRow(row) {
        return {
            originalName: row.originalName,
            name: row.name.trim(),
            backgroundColor: row.backgroundColor.trim(),
        };
    });
    const items = normalizedRows.map(function mapItem(row) {
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
    const nextNames = new Set(items.map(function mapItemName(item) {
        return item.name;
    }));
    const renamedItems = normalizedRows
        .filter(function isRenamedItem(row) {
            return row.originalName && row.originalName !== row.name;
        })
        .map(function mapRenamedItem(row) {
            return {
                previousName: row.originalName,
                nextName: row.name,
            };
        });
    const deletedItems = originalItems
        .map(function mapOriginalItemName(item) {
            return item.name;
        })
        .filter(function isDeletedItem(itemName) {
            return !activeOriginalNames.has(itemName)
                && !nextNames.has(itemName);
        });

    return {
        [updateKeys.items]: items,
        [updateKeys.renamedItems]: renamedItems,
        [updateKeys.deletedItems]: deletedItems,
    };
}


function hasReferenceImpact(itemUpdate, updateKeys) {
    return itemUpdate[updateKeys.renamedItems].length > 0
        || itemUpdate[updateKeys.deletedItems].length > 0;
}
