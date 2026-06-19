function padTwoDigits(value: number): string {
	return String(value).padStart(2, '0');
}

function formatUtcDate(year: number, month: number, day: number): string {
	return `${year}-${padTwoDigits(month)}-${padTwoDigits(day)}`;
}

function requireInteger(value: number, label: string): void {
	if (!Number.isInteger(value)) {
		throw new Error(`${label} must be an integer: ${String(value)}`);
	}
}

function getUtcDate(year: number, month: number, day: number): Date {
	return new Date(Date.UTC(year, month - 1, day));
}

function parseIsoDateParts(date: string): {
	year: number;
	month: number;
	day: number;
} {
	if (!isIsoDateString(date)) {
		throw new Error(`Invalid ISO date string: ${String(date)}`);
	}

	const [yearText, monthText, dayText] = date.split('-');
	return {
		year: Number(yearText),
		month: Number(monthText),
		day: Number(dayText),
	};
}

function getWeekAnchorForYear(year: number): string {
	const firstDayOfYear = getDateForYearMonthDay(year, 1, 1);
	const weekday = getUtcDate(year, 1, 1).getUTCDay();
	return addCalendarDays(firstDayOfYear, -weekday);
}

function getDayDifference(left: string, right: string): number {
	const leftParts = parseIsoDateParts(left);
	const rightParts = parseIsoDateParts(right);
	const leftTime = getUtcDate(
		leftParts.year,
		leftParts.month,
		leftParts.day,
	).getTime();
	const rightTime = getUtcDate(
		rightParts.year,
		rightParts.month,
		rightParts.day,
	).getTime();

	return Math.round((leftTime - rightTime) / 86400000);
}

export function isIsoDateString(value: unknown): value is string {
	if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		return false;
	}

	const [yearText, monthText, dayText] = value.split('-');
	const year = Number(yearText);
	const month = Number(monthText);
	const day = Number(dayText);

	const candidate = new Date(Date.UTC(year, month - 1, day));

	return (
		candidate.getUTCFullYear() === year &&
		candidate.getUTCMonth() === month - 1 &&
		candidate.getUTCDate() === day
	);
}

export function addCalendarDays(date: string, days: number): string {
	if (!isIsoDateString(date)) {
		throw new Error(`Invalid ISO date string: ${String(date)}`);
	}

	if (!Number.isInteger(days)) {
		throw new Error(`Calendar day delta must be an integer: ${String(days)}`);
	}

	const [yearText, monthText, dayText] = date.split('-');
	const year = Number(yearText);
	const month = Number(monthText);
	const day = Number(dayText);

	const candidate = new Date(Date.UTC(year, month - 1, day + days));

	return formatUtcDate(
		candidate.getUTCFullYear(),
		candidate.getUTCMonth() + 1,
		candidate.getUTCDate(),
	);
}

export function getDateForYearMonthDay(
	year: number,
	month: number,
	day: number,
): string {
	requireInteger(year, 'Year');
	requireInteger(month, 'Month');
	requireInteger(day, 'Day');

	const candidate = getUtcDate(year, month, day);
	if (
		candidate.getUTCFullYear() !== year ||
		candidate.getUTCMonth() !== month - 1 ||
		candidate.getUTCDate() !== day
	) {
		throw new Error(
			`Invalid year/month/day combination: ${year}-${month}-${day}`,
		);
	}

	return formatUtcDate(year, month, day);
}

export function getDaysInMonth(year: number, month: number): number {
	requireInteger(year, 'Year');
	requireInteger(month, 'Month');

	if (month < 1 || month > 12) {
		throw new Error(`Month must be between 1 and 12: ${String(month)}`);
	}

	return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function clampDateToMonth(
	year: number,
	month: number,
	day: number,
): string {
	requireInteger(day, 'Day');

	const clampedDay = Math.min(Math.max(day, 1), getDaysInMonth(year, month));
	return getDateForYearMonthDay(year, month, clampedDay);
}

export function getWeekNumberForDate(date: string): number {
	const { year, month, day } = parseIsoDateParts(date);
	const weekStart = addCalendarDays(date, -getUtcDate(year, month, day).getUTCDay());
	const weekAnchor = getWeekAnchorForYear(year);
	return Math.floor(getDayDifference(weekStart, weekAnchor) / 7) + 1;
}

export function getWeekCountForYear(year: number): number {
	return getWeekNumberForDate(getDateForYearMonthDay(year, 12, 31));
}

export function getStartDateForWeek(year: number, weekNumber: number): string {
	requireInteger(year, 'Year');
	requireInteger(weekNumber, 'Week number');

	const weekCount = getWeekCountForYear(year);
	if (weekNumber < 1 || weekNumber > weekCount) {
		throw new Error(
			`Week number ${String(weekNumber)} is out of range for year ${String(year)}`,
		);
	}

	return addCalendarDays(getWeekAnchorForYear(year), (weekNumber - 1) * 7);
}

export function compareIsoDates(a: string, b: string): number {
	if (!isIsoDateString(a) || !isIsoDateString(b)) {
		throw new Error(`Invalid ISO date comparison: ${a} vs ${b}`);
	}

	return a.localeCompare(b);
}

export function isBeforeDate(a: string, b: string): boolean {
	return compareIsoDates(a, b) < 0;
}

export function isSameDate(a: string, b: string): boolean {
	return compareIsoDates(a, b) === 0;
}

export function isAfterDate(a: string, b: string): boolean {
	return compareIsoDates(a, b) > 0;
}

export function todayIsoDate(): string {
	const now = new Date();
	return formatUtcDate(
		now.getFullYear(),
		now.getMonth() + 1,
		now.getDate(),
	);
}
