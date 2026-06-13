function padTwoDigits(value: number): string {
	return String(value).padStart(2, '0');
}

function formatUtcDate(year: number, month: number, day: number): string {
	return `${year}-${padTwoDigits(month)}-${padTwoDigits(day)}`;
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
