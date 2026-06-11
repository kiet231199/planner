import { useEffect, useMemo, useState } from "react";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import {
    Box,
    IconButton,
    InputAdornment,
    Popover,
    TextField,
    Typography,
} from "@mui/material";


const DATE_PART_RADIX = 10;
const DATE_DISPLAY_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const DAYS_IN_WEEK = 7;
const CALENDAR_DAY_COUNT = 42;
const MONTH_OFFSET = 1;
const MONTH_INDEX_OFFSET = 1;
const FIRST_DAY_OF_MONTH = 1;
const EMPTY_CALENDAR_DAYS = [];
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
});


export default function PlannerDateField(props) {
    const {
        name,
        value,
        disabled = false,
        onChange,
        ...textFieldProps
    } = props;
    const [anchorElement, setAnchorElement] = useState(null);
    const [displayValue, setDisplayValue] = useState(formatDateForDisplay(value));
    const [visibleMonth, setVisibleMonth] = useState(function getInitialVisibleMonth() {
        return getVisibleMonth(value);
    });
    const isOpen = Boolean(anchorElement);
    const calendarDays = useMemo(function memoizeCalendarDays() {
        return getCalendarDays(visibleMonth);
    }, [visibleMonth]);

    useEffect(function syncDisplayValue() {
        setDisplayValue(formatDateForDisplay(value));
    }, [value]);

    useEffect(function syncVisibleMonth() {
        if (!value) {
            return;
        }

        setVisibleMonth(getVisibleMonth(value));
    }, [value]);

    function openCalendar(event) {
        if (disabled) {
            return;
        }

        setAnchorElement(event.currentTarget);
    }

    function closeCalendar() {
        setAnchorElement(null);
        setDisplayValue(formatDateForDisplay(value));
    }

    function handleInputChange(event) {
        const nextDisplayValue = event.target.value;

        setDisplayValue(nextDisplayValue);

        if (nextDisplayValue === "") {
            emitDateChange(name, "", onChange);
            return;
        }

        const nextDateValue = parseDisplayDate(nextDisplayValue);

        if (nextDateValue) {
            emitDateChange(name, nextDateValue, onChange);
        }
    }

    function handleInputBlur() {
        setDisplayValue(formatDateForDisplay(value));
    }

    function moveToPreviousMonth() {
        setVisibleMonth(function updateMonth(currentMonth) {
            return new Date(
                currentMonth.getFullYear(),
                currentMonth.getMonth() - MONTH_INDEX_OFFSET,
                FIRST_DAY_OF_MONTH,
            );
        });
    }

    function moveToNextMonth() {
        setVisibleMonth(function updateMonth(currentMonth) {
            return new Date(
                currentMonth.getFullYear(),
                currentMonth.getMonth() + MONTH_INDEX_OFFSET,
                FIRST_DAY_OF_MONTH,
            );
        });
    }

    function selectDate(date) {
        const nextDateValue = formatDateForValue(date);

        emitDateChange(name, nextDateValue, onChange);
        setDisplayValue(formatDateForDisplay(nextDateValue));
        setAnchorElement(null);
    }

    return (
        <>
            <TextField
                {...textFieldProps}
                name={name}
                value={displayValue}
                disabled={disabled}
                placeholder="dd/mm/yyyy"
                onClick={openCalendar}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                InputProps={{
                    endAdornment: (
                        <InputAdornment position="end">
                            <IconButton
                                edge="end"
                                size="small"
                                disabled={disabled}
                                aria-label="Open calendar"
                                onMouseDown={function keepDateFieldFocused(event) {
                                    event.preventDefault();
                                }}
                                onClick={openCalendar}
                            >
                                <CalendarMonthIcon fontSize="small" />
                            </IconButton>
                        </InputAdornment>
                    ),
                }}
            />
            <Popover
                open={isOpen}
                anchorEl={anchorElement}
                onClose={closeCalendar}
                anchorOrigin={{
                    vertical: "bottom",
                    horizontal: "left",
                }}
            >
                <Box className="planner-date-picker">
                    <Box className="planner-date-picker-header">
                        <IconButton
                            size="small"
                            aria-label="Previous month"
                            onClick={moveToPreviousMonth}
                        >
                            <ChevronLeftIcon fontSize="small" />
                        </IconButton>
                        <Typography className="planner-date-picker-month">
                            {MONTH_LABEL_FORMATTER.format(visibleMonth)}
                        </Typography>
                        <IconButton
                            size="small"
                            aria-label="Next month"
                            onClick={moveToNextMonth}
                        >
                            <ChevronRightIcon fontSize="small" />
                        </IconButton>
                    </Box>
                    <Box className="planner-date-picker-grid">
                        {WEEKDAY_LABELS.map(function renderWeekdayLabel(label) {
                            return (
                                <Typography
                                    key={label}
                                    className="planner-date-picker-weekday"
                                >
                                    {label}
                                </Typography>
                            );
                        })}
                        {calendarDays.map(function renderCalendarDay(dayInfo) {
                            const className = getCalendarDayClassName(dayInfo, value);

                            return (
                                <button
                                    key={dayInfo.key}
                                    type="button"
                                    className={className}
                                    onClick={function selectCalendarDate() {
                                        selectDate(dayInfo.date);
                                    }}
                                >
                                    {dayInfo.date.getDate()}
                                </button>
                            );
                        })}
                    </Box>
                </Box>
            </Popover>
        </>
    );
}


function emitDateChange(name, value, onChange) {
    onChange({
        target: {
            name,
            value,
        },
    });
}


function getVisibleMonth(dateValue) {
    const date = parseValueDate(dateValue) || new Date();

    return new Date(date.getFullYear(), date.getMonth(), FIRST_DAY_OF_MONTH);
}


function getCalendarDays(visibleMonth) {
    if (!visibleMonth) {
        return EMPTY_CALENDAR_DAYS;
    }

    const monthStartDate = new Date(
        visibleMonth.getFullYear(),
        visibleMonth.getMonth(),
        FIRST_DAY_OF_MONTH,
    );
    const dayOffset = getMondayBasedDayOffset(monthStartDate);
    const calendarStartDate = new Date(
        monthStartDate.getFullYear(),
        monthStartDate.getMonth(),
        FIRST_DAY_OF_MONTH - dayOffset,
    );

    return Array.from({ length: CALENDAR_DAY_COUNT }, function mapCalendarDay(_, index) {
        const date = new Date(
            calendarStartDate.getFullYear(),
            calendarStartDate.getMonth(),
            calendarStartDate.getDate() + index,
        );
        const value = formatDateForValue(date);

        return {
            key: value,
            value,
            date,
            isCurrentMonth: date.getMonth() === visibleMonth.getMonth(),
        };
    });
}


function getMondayBasedDayOffset(date) {
    return (date.getDay() + DAYS_IN_WEEK - MONTH_INDEX_OFFSET) % DAYS_IN_WEEK;
}


function getCalendarDayClassName(dayInfo, selectedValue) {
    const classNames = ["planner-date-picker-day"];

    if (!dayInfo.isCurrentMonth) {
        classNames.push("planner-date-picker-day-muted");
    }

    if (dayInfo.value === selectedValue) {
        classNames.push("planner-date-picker-day-selected");
    }

    if (dayInfo.value === formatDateForValue(new Date())) {
        classNames.push("planner-date-picker-day-today");
    }

    return classNames.join(" ");
}


export function formatDateForDisplay(dateValue) {
    const date = parseValueDate(dateValue);

    if (!date) {
        return "";
    }

    return [
        padDatePart(date.getDate()),
        padDatePart(date.getMonth() + MONTH_OFFSET),
        String(date.getFullYear()),
    ].join("/");
}


function parseDisplayDate(displayValue) {
    const match = displayValue.match(DATE_DISPLAY_PATTERN);

    if (!match) {
        return "";
    }

    const day = parseInt(match[1], DATE_PART_RADIX);
    const month = parseInt(match[2], DATE_PART_RADIX);
    const year = parseInt(match[3], DATE_PART_RADIX);
    const date = new Date(year, month - MONTH_OFFSET, day);

    if (
        date.getFullYear() !== year
        || date.getMonth() !== month - MONTH_OFFSET
        || date.getDate() !== day
    ) {
        return "";
    }

    return formatDateForValue(date);
}


function parseValueDate(dateValue) {
    if (!dateValue) {
        return null;
    }

    const [year, month, day] = dateValue.split("-").map(function parseDatePart(datePart) {
        return parseInt(datePart, DATE_PART_RADIX);
    });
    const date = new Date(year, month - MONTH_OFFSET, day);

    if (
        date.getFullYear() !== year
        || date.getMonth() !== month - MONTH_OFFSET
        || date.getDate() !== day
    ) {
        return null;
    }

    return date;
}


function formatDateForValue(date) {
    return [
        String(date.getFullYear()),
        padDatePart(date.getMonth() + MONTH_OFFSET),
        padDatePart(date.getDate()),
    ].join("-");
}


function padDatePart(value) {
    return String(value).padStart(2, "0");
}
