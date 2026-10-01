// Timezone helpers: "today" and "tomorrow" follow the user's local day, not UTC.

const validTimezone = (tz) => {
	if (!tz || typeof tz !== 'string') return null;
	try {
		new Intl.DateTimeFormat('en-US', { timeZone: tz });
		return tz;
	} catch {
		return null;
	}
};

/** YYYY-MM-DD for `now` in `tz`. */
const localDay = (now, tz = 'UTC') =>
	new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

/** The instant of the next local midnight in `tz`. */
const nextLocalMidnight = (now, tz = 'UTC') => {
	const local = new Date(now.toLocaleString('en-US', { timeZone: tz }));
	const offset = local.getTime() - now.getTime();
	const midnight = new Date(local);
	midnight.setHours(24, 0, 0, 0);
	return new Date(midnight.getTime() - offset);
};

const addDays = (now, days) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

module.exports = { validTimezone, localDay, nextLocalMidnight, addDays };
