export function monthKey(date, timeZone = 'UTC') {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
    }).formatToParts(date);
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    if (!year || !month)
        throw new Error('Could not derive month key');
    return `${year}-${month}`;
}
export function startOfMonthUtc(year, monthIndex) {
    return new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
}
/** Inclusive start and exclusive end of a calendar month in the household timezone. */
export function dateRangeForMonth(key, timeZone = 'UTC') {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(key))
        throw new Error('Invalid month key');
    const [year, month] = key.split('-').map(Number);
    const midnight = (monthIndex) => {
        const target = Date.UTC(year, monthIndex, 1);
        let instant = target;
        const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hourCycle: 'h23',
        });
        for (let i = 0; i < 3; i++) {
            const parts = formatter.formatToParts(new Date(instant));
            const get = (type) => Number(parts.find((part) => part.type === type)?.value);
            const local = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
            instant += target - local;
        }
        return new Date(instant);
    };
    return { start: midnight(month - 1), end: midnight(month) };
}
export function dateRangeForPreset(preset, now = new Date(), timeZone = 'UTC') {
    const [year, monthNumber] = monthKey(now, timeZone).split('-').map(Number);
    const month = monthNumber - 1;
    const start = (offset) => dateRangeForMonth(monthKey(startOfMonthUtc(year, offset)), timeZone).start;
    const end = start(month + 1);
    if (preset === 'THIS_MONTH')
        return { start: start(month), end };
    if (preset === 'LAST_MONTH')
        return { start: start(month - 1), end: start(month) };
    if (preset === 'LAST_3_MONTHS')
        return { start: start(month - 2), end };
    if (preset === 'LAST_6_MONTHS')
        return { start: start(month - 5), end };
    if (preset === 'LAST_12_MONTHS')
        return { start: start(month - 11), end };
    return { start: start(0), end };
}
