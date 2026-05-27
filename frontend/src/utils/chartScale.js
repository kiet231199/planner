const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const GENERATED_PAST_DAYS = 365;
const GENERATED_FUTURE_DAYS = 730;
const GENERATED_YEAR_MODE_PAST_YEARS = 10;
const GENERATED_YEAR_MODE_FUTURE_YEARS = 20;
const YEAR_MODE_SCROLL_BUFFER_YEARS = 4;
const TASK_RANGE_PADDING_DAYS = 30;
const MIN_BAR_WIDTH_PIXELS = 28;
const ROW_HEIGHT_PIXELS = 38;
const TIMELINE_HEADER_ROW_HEIGHT_PIXELS = 38;
const TIMELINE_HEADER_ROW_COUNT = 2;
const TIMELINE_HEADER_HEIGHT_PIXELS = (
    TIMELINE_HEADER_ROW_HEIGHT_PIXELS * TIMELINE_HEADER_ROW_COUNT
);
const DAY_MODE_MIN_WIDTH_PIXELS = 36;
const DAY_MODE_MAX_WIDTH_PIXELS = 78;
const DEFAULT_DAY_WIDTH_PIXELS = 56;
const WEEK_LABEL_MIN_WIDTH_PIXELS = 40;
const MONTH_LABEL_MIN_WIDTH_PIXELS = 44;
const YEAR_LABEL_MIN_WIDTH_PIXELS = 80;
const DAYS_PER_WEEK = 7;
const WEEKS_PER_MONTH_FOR_ZOOM = 4;
const MONTHS_PER_YEAR = 12;
const CURRENT_YEAR_COUNT = 1;
const NO_MINIMUM_TIMELINE_WIDTH = 0;
const FIRST_MONTH_INDEX = 0;
const FIRST_DAY_OF_MONTH = 1;
const LAST_MONTH_INDEX = 11;
const LAST_DAY_OF_DECEMBER = 31;
const WEEK_MODE_MAX_WIDTH_PIXELS = (DAY_MODE_MIN_WIDTH_PIXELS - 1) * DAYS_PER_WEEK;
const MONTH_MODE_MAX_WIDTH_PIXELS = (
    WEEK_LABEL_MIN_WIDTH_PIXELS - 1
) * WEEKS_PER_MONTH_FOR_ZOOM;
const YEAR_MODE_MAX_WIDTH_PIXELS = (MONTH_LABEL_MIN_WIDTH_PIXELS - 1) * MONTHS_PER_YEAR;
const DAY_MODE_WIDTH_STEP_PIXELS = 1;
const WEEK_MODE_WIDTH_STEP_PIXELS = 4;
const MONTH_MODE_WIDTH_STEP_PIXELS = 4;
const YEAR_MODE_WIDTH_STEP_PIXELS = 8;

export const ZOOM_LEVELS = buildZoomLevels();
export const DEFAULT_ZOOM_INDEX = getDefaultZoomIndex();
export const MAX_ZOOM_INDEX = ZOOM_LEVELS.length - 1;
export const MIN_ZOOM_INDEX = 0;


export function getTimelineMetrics(
    tasks,
    zoomIndex,
    minimumTimelineWidth = NO_MINIMUM_TIMELINE_WIDTH,
) {
    const zoomLevel = ZOOM_LEVELS[zoomIndex] || ZOOM_LEVELS[DEFAULT_ZOOM_INDEX];
    const visibleRange = getGeneratedRange(tasks, zoomLevel, minimumTimelineWidth);
    const totalDays = getInclusiveDayCount(visibleRange.startDate, visibleRange.stopDate);
    const days = buildDays(visibleRange.startDate, totalDays);
    const gridCells = buildGridCells(days, zoomLevel);
    const timelineWidth = getTimelineWidth(gridCells);
    const headerRows = buildHeaderRows(gridCells, zoomLevel);
    const headerHeight = getTimelineHeaderHeight();
    const today = normalizeDate(new Date());
    const todayScrollLeft = getDateOffset(today, gridCells);
    const todayDayWidth = getPixelsPerDayAtDate(today, gridCells);

    return {
        days,
        gridCells,
        headerRows,
        rowHeight: ROW_HEIGHT_PIXELS,
        headerHeight,
        timelineWidth,
        dayWidth: todayDayWidth,
        todayScrollLeft,
        zoomLabel: zoomLevel.label,
        bars: tasks.map(function mapTaskToBar(task, index) {
            return createTaskBar(task, index, gridCells);
        }),
    };
}


export function getDurationDays(task) {
    return getInclusiveDayCount(parseDate(task.startDate), parseDate(task.stopDate));
}


export function getTimelineHeaderHeight() {
    return TIMELINE_HEADER_HEIGHT_PIXELS;
}


export function getTimelineDateAtOffset(offset, gridCells) {
    let currentOffset = 0;

    for (const cell of gridCells) {
        const nextOffset = currentOffset + cell.width;

        if (offset <= nextOffset) {
            const cellOffset = Math.max(0, offset - currentOffset);
            const dayOffset = cellOffset / getPixelsPerDay(cell);

            return {
                date: addDays(cell.startDate, Math.floor(dayOffset)),
                dayRatio: dayOffset - Math.floor(dayOffset),
            };
        }

        currentOffset = nextOffset;
    }

    const lastCell = gridCells[gridCells.length - 1];

    return {
        date: lastCell.stopDate,
        dayRatio: 1,
    };
}


export function getTimelineOffsetForDate(date, dayRatio, gridCells) {
    return getDateOffset(date, gridCells) + dayRatio * getPixelsPerDayAtDate(date, gridCells);
}


export function addDaysToDateString(value, daysToAdd) {
    return formatDate(addDays(parseDate(value), daysToAdd));
}


export function getDateDeltaDays(startDate, stopDate) {
    return getDayOffset(startDate, stopDate);
}


function buildZoomLevels() {
    const zoomLevels = [];

    addZoomLevels(
        zoomLevels,
        "year",
        YEAR_LABEL_MIN_WIDTH_PIXELS,
        YEAR_MODE_MAX_WIDTH_PIXELS,
        YEAR_MODE_WIDTH_STEP_PIXELS,
    );
    addZoomLevels(
        zoomLevels,
        "month",
        MONTH_LABEL_MIN_WIDTH_PIXELS,
        MONTH_MODE_MAX_WIDTH_PIXELS,
        MONTH_MODE_WIDTH_STEP_PIXELS,
    );
    addZoomLevels(
        zoomLevels,
        "week",
        WEEK_LABEL_MIN_WIDTH_PIXELS,
        WEEK_MODE_MAX_WIDTH_PIXELS,
        WEEK_MODE_WIDTH_STEP_PIXELS,
    );
    addZoomLevels(
        zoomLevels,
        "day",
        DAY_MODE_MIN_WIDTH_PIXELS,
        DAY_MODE_MAX_WIDTH_PIXELS,
        DAY_MODE_WIDTH_STEP_PIXELS,
    );

    return zoomLevels;
}


function addZoomLevels(zoomLevels, headerMode, minWidth, maxWidth, step) {
    for (let unitWidth = minWidth; unitWidth <= maxWidth; unitWidth += step) {
        zoomLevels.push({
            label: formatZoomLabel(headerMode),
            unitWidth,
            headerMode,
        });
    }
}


function getDefaultZoomIndex() {
    return ZOOM_LEVELS.findIndex(function matchDefaultZoomLevel(zoomLevel) {
        return zoomLevel.headerMode === "day" && zoomLevel.unitWidth === DEFAULT_DAY_WIDTH_PIXELS;
    });
}


function formatZoomLabel(headerMode) {
    const labels = {
        day: "Day",
        week: "Week",
        month: "Month",
        year: "Year",
    };

    return labels[headerMode];
}


function buildHeaderRows(gridCells, zoomLevel) {
    if (zoomLevel.headerMode === "year") {
        return [
            buildTimelineCellHeaderSegments(gridCells, formatYearLabel),
        ];
    }

    if (zoomLevel.headerMode === "month") {
        return [
            buildGroupedHeaderSegments(gridCells, getYearKey, formatYearLabel),
            buildTimelineCellHeaderSegments(gridCells, formatMonthName),
        ];
    }

    if (zoomLevel.headerMode === "week") {
        return [
            buildGroupedHeaderSegments(gridCells, getMonthKey, formatMonthYearLabel),
            buildTimelineCellHeaderSegments(gridCells, formatWeekLabel),
        ];
    }

    return [
        buildGroupedHeaderSegments(gridCells, getMonthKey, formatMonthYearLabel),
        buildTimelineCellHeaderSegments(gridCells, formatDayLabel),
    ];
}


function buildTimelineCellHeaderSegments(gridCells, formatLabel) {
    return gridCells.map(function mapCellToSegment(cell) {
        return {
            key: cell.key,
            label: formatLabel(cell.startDate),
            width: cell.width,
        };
    });
}


function buildGroupedHeaderSegments(gridCells, getGroupKey, formatGroupLabel) {
    const segments = [];

    gridCells.forEach(function groupCell(cell) {
        const groupKey = getGroupKey(cell.startDate);
        const lastSegment = segments[segments.length - 1];

        if (lastSegment && lastSegment.key === groupKey) {
            lastSegment.width += cell.width;
            return;
        }

        segments.push({
            key: groupKey,
            label: formatGroupLabel(cell.startDate),
            width: cell.width,
        });
    });

    return segments;
}


function createTaskBar(task, index, gridCells) {
    const taskStartDate = parseDate(task.startDate);
    const taskEndDate = addDays(parseDate(task.stopDate), 1);
    const left = getDateOffset(taskStartDate, gridCells);
    const right = getDateOffset(taskEndDate, gridCells);
    const width = Math.max(right - left, MIN_BAR_WIDTH_PIXELS);

    return {
        task,
        left,
        top: index * ROW_HEIGHT_PIXELS,
        width,
    };
}


function getGeneratedRange(tasks, zoomLevel, minimumTimelineWidth) {
    const today = normalizeDate(new Date());
    const defaultRange = getDefaultGeneratedRange(today, zoomLevel, minimumTimelineWidth);

    if (tasks.length === 0) {
        return defaultRange;
    }

    const taskStartDates = tasks.map(function mapStartDate(task) {
        return parseDate(task.startDate);
    });
    const taskStopDates = tasks.map(function mapStopDate(task) {
        return parseDate(task.stopDate);
    });
    const earliestTaskStartDate = addDays(new Date(Math.min(...taskStartDates)), -TASK_RANGE_PADDING_DAYS);
    const latestTaskStopDate = addDays(new Date(Math.max(...taskStopDates)), TASK_RANGE_PADDING_DAYS);

    return {
        startDate: new Date(Math.min(defaultRange.startDate, earliestTaskStartDate)),
        stopDate: new Date(Math.max(defaultRange.stopDate, latestTaskStopDate)),
    };
}


function getDefaultGeneratedRange(today, zoomLevel, minimumTimelineWidth) {
    if (zoomLevel.headerMode === "year") {
        return getYearModeGeneratedRange(today, zoomLevel, minimumTimelineWidth);
    }

    return {
        startDate: addDays(today, -GENERATED_PAST_DAYS),
        stopDate: addDays(today, GENERATED_FUTURE_DAYS),
    };
}


function getYearModeGeneratedRange(today, zoomLevel, minimumTimelineWidth) {
    const currentYear = today.getFullYear();
    const futureYears = getYearModeFutureYears(zoomLevel, minimumTimelineWidth);

    return {
        startDate: new Date(
            currentYear - GENERATED_YEAR_MODE_PAST_YEARS,
            FIRST_MONTH_INDEX,
            FIRST_DAY_OF_MONTH,
        ),
        stopDate: new Date(
            currentYear + futureYears,
            LAST_MONTH_INDEX,
            LAST_DAY_OF_DECEMBER,
        ),
    };
}


function getYearModeFutureYears(zoomLevel, minimumTimelineWidth) {
    const minimumYearCount = (
        Math.ceil(minimumTimelineWidth / zoomLevel.unitWidth)
        + YEAR_MODE_SCROLL_BUFFER_YEARS
    );
    const minimumFutureYears = (
        minimumYearCount
        - GENERATED_YEAR_MODE_PAST_YEARS
        - CURRENT_YEAR_COUNT
    );

    return Math.max(GENERATED_YEAR_MODE_FUTURE_YEARS, minimumFutureYears);
}


function buildGridCells(days, zoomLevel) {
    if (zoomLevel.headerMode === "year") {
        return buildGroupedGridCells(days, zoomLevel.unitWidth, getYearKey, getDaysInYear);
    }

    if (zoomLevel.headerMode === "month") {
        return buildGroupedGridCells(days, zoomLevel.unitWidth, getMonthKey, getDaysInMonth);
    }

    if (zoomLevel.headerMode === "week") {
        return buildGroupedGridCells(days, zoomLevel.unitWidth, getWeekKey, getDaysInWeek);
    }

    return days.map(function mapDayToCell(day) {
        return {
            key: day.toISOString(),
            startDate: day,
            stopDate: day,
            dayCount: 1,
            width: zoomLevel.unitWidth,
        };
    });
}


function buildGroupedGridCells(days, unitWidth, getGroupKey, getUnitDayCount) {
    const gridCells = [];

    days.forEach(function groupDay(day) {
        const groupKey = getGroupKey(day);
        const lastCell = gridCells[gridCells.length - 1];

        if (lastCell && lastCell.key === groupKey) {
            lastCell.stopDate = day;
            lastCell.dayCount += 1;
            lastCell.width = getGridCellWidth(lastCell, unitWidth, getUnitDayCount);
            return;
        }

        const gridCell = {
            key: groupKey,
            startDate: day,
            stopDate: day,
            dayCount: 1,
            width: 0,
        };
        gridCell.width = getGridCellWidth(gridCell, unitWidth, getUnitDayCount);
        gridCells.push(gridCell);
    });

    return gridCells;
}


function getGridCellWidth(gridCell, unitWidth, getUnitDayCount) {
    return gridCell.dayCount / getUnitDayCount(gridCell.startDate) * unitWidth;
}


function getTimelineWidth(gridCells) {
    return gridCells.reduce(function addGridCellWidth(width, cell) {
        return width + cell.width;
    }, 0);
}


function getDateOffset(date, gridCells) {
    const normalizedDate = normalizeDate(date);
    let offset = 0;

    for (const cell of gridCells) {
        if (normalizedDate <= cell.stopDate) {
            const daysIntoCell = getDayOffset(cell.startDate, normalizedDate);
            const clampedDaysIntoCell = Math.max(0, Math.min(daysIntoCell, cell.dayCount));

            return offset + clampedDaysIntoCell * getPixelsPerDay(cell);
        }

        offset += cell.width;
    }

    return offset;
}


function getPixelsPerDayAtDate(date, gridCells) {
    const normalizedDate = normalizeDate(date);

    for (const cell of gridCells) {
        if (normalizedDate >= cell.startDate && normalizedDate <= cell.stopDate) {
            return getPixelsPerDay(cell);
        }
    }

    return getPixelsPerDay(gridCells[0]);
}


function getPixelsPerDay(gridCell) {
    return gridCell.width / gridCell.dayCount;
}


function buildDays(startDate, totalDays) {
    return Array.from({ length: totalDays }, function createDay(_, index) {
        return addDays(startDate, index);
    });
}


function parseDate(value) {
    const [year, month, day] = value.split("-").map(Number);

    return new Date(year, month - 1, day);
}


function normalizeDate(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}


function addDays(date, daysToAdd) {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + daysToAdd);

    return normalizeDate(nextDate);
}


function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


function getDayOffset(startDate, targetDate) {
    return Math.round((normalizeDate(targetDate) - normalizeDate(startDate)) / DAY_IN_MILLISECONDS);
}


function getInclusiveDayCount(startDate, stopDate) {
    return getDayOffset(startDate, stopDate) + 1;
}


function getYearKey(date) {
    return String(date.getFullYear());
}


function getMonthKey(date) {
    return `${date.getFullYear()}-${date.getMonth()}`;
}


function getWeekKey(date) {
    const weekStartDate = getWeekStartDate(date);

    return weekStartDate.toISOString();
}


function getWeekStartDate(date) {
    const normalizedDate = normalizeDate(date);
    const daysFromMonday = (normalizedDate.getDay() + 6) % 7;

    return addDays(normalizedDate, -daysFromMonday);
}


function formatYearLabel(date) {
    return String(date.getFullYear());
}


function formatDayLabel(date) {
    return String(date.getDate());
}


function formatMonthName(date) {
    return new Intl.DateTimeFormat("en", {
        month: "short",
    }).format(date);
}


function formatMonthYearLabel(date) {
    return new Intl.DateTimeFormat("en", {
        month: "short",
        year: "numeric",
    }).format(date);
}


function formatWeekLabel(date) {
    const weekNumber = getIsoWeekNumber(date);
    const weekLabel = String(weekNumber).padStart(2, "0");

    return `W${weekLabel}`;
}


function getIsoWeekNumber(date) {
    const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayOfWeek = utcDate.getUTCDay() || 7;
    utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayOfWeek);

    const yearStartDate = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
    const daysSinceYearStart = (utcDate - yearStartDate) / DAY_IN_MILLISECONDS;

    return Math.ceil((daysSinceYearStart + 1) / 7);
}


function getDaysInWeek() {
    return DAYS_PER_WEEK;
}


function getDaysInMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}


function getDaysInYear(date) {
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const startOfNextYear = new Date(date.getFullYear() + 1, 0, 1);

    return getDayOffset(startOfYear, startOfNextYear);
}
