const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const DEFAULT_VISIBLE_DAYS = 14;
const MIN_BAR_WIDTH_PIXELS = 28;
const ROW_HEIGHT_PIXELS = 38;
const TIMELINE_HEADER_HEIGHT_PIXELS = 38;

export const ZOOM_LEVELS = [
    {
        label: "Compact",
        dayWidth: 34,
    },
    {
        label: "Normal",
        dayWidth: 54,
    },
    {
        label: "Detailed",
        dayWidth: 78,
    },
];


export function getTimelineMetrics(tasks, zoomIndex) {
    const visibleRange = getVisibleRange(tasks);
    const totalDays = getInclusiveDayCount(visibleRange.startDate, visibleRange.stopDate);
    const zoomLevel = ZOOM_LEVELS[zoomIndex] || ZOOM_LEVELS[1];
    const timelineWidth = totalDays * zoomLevel.dayWidth;
    const days = buildDays(visibleRange.startDate, totalDays);

    return {
        days,
        rowHeight: ROW_HEIGHT_PIXELS,
        headerHeight: TIMELINE_HEADER_HEIGHT_PIXELS,
        timelineWidth,
        dayWidth: zoomLevel.dayWidth,
        zoomLabel: zoomLevel.label,
        bars: tasks.map(function mapTaskToBar(task, index) {
            return createTaskBar(task, index, visibleRange.startDate, zoomLevel.dayWidth);
        }),
    };
}


export function getDurationDays(task) {
    return getInclusiveDayCount(parseDate(task.startDate), parseDate(task.stopDate));
}


export function formatDateLabel(date) {
    return new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
    }).format(date);
}


function createTaskBar(task, index, rangeStartDate, dayWidth) {
    const taskStartDate = parseDate(task.startDate);
    const taskStopDate = parseDate(task.stopDate);
    const startOffsetDays = getDayOffset(rangeStartDate, taskStartDate);
    const taskDurationDays = getInclusiveDayCount(taskStartDate, taskStopDate);
    const width = Math.max(taskDurationDays * dayWidth, MIN_BAR_WIDTH_PIXELS);

    return {
        task,
        left: startOffsetDays * dayWidth,
        top: index * ROW_HEIGHT_PIXELS,
        width,
    };
}


function getVisibleRange(tasks) {
    if (tasks.length === 0) {
        const today = normalizeDate(new Date());
        const stopDate = addDays(today, DEFAULT_VISIBLE_DAYS - 1);

        return {
            startDate: today,
            stopDate,
        };
    }

    const startDates = tasks.map(function mapStartDate(task) {
        return parseDate(task.startDate);
    });
    const stopDates = tasks.map(function mapStopDate(task) {
        return parseDate(task.stopDate);
    });

    return {
        startDate: addDays(new Date(Math.min(...startDates)), -1),
        stopDate: addDays(new Date(Math.max(...stopDates)), 1),
    };
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


function getDayOffset(startDate, targetDate) {
    return Math.round((normalizeDate(targetDate) - normalizeDate(startDate)) / DAY_IN_MILLISECONDS);
}


function getInclusiveDayCount(startDate, stopDate) {
    return getDayOffset(startDate, stopDate) + 1;
}
