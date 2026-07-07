/** US federal + common observances, keyed yyyy-MM-dd */

function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
    const d = new Date(year, month, 1);
    let count = 0;
    while (d.getMonth() === month) {
        if (d.getDay() === weekday) {
            count += 1;
            if (count === n) return new Date(d);
        }
        d.setDate(d.getDate() + 1);
    }
    return new Date(year, month, 1);
}

function lastWeekdayOfMonth(year: number, month: number, weekday: number): Date {
    const d = new Date(year, month + 1, 0);
    while (d.getDay() !== weekday) d.setDate(d.getDate() - 1);
    return d;
}

function observe(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    if (day === 6) d.setDate(d.getDate() - 1);
    if (day === 0) d.setDate(d.getDate() + 1);
    return d;
}

function key(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function add(map: Record<string, string>, d: Date, name: string, observed = true) {
    const k = key(observed ? observe(d) : d);
    map[k] = name;
}

export function buildUsHolidays(startYear: number, endYear: number): Record<string, string> {
    const out: Record<string, string> = {};
    for (let y = startYear; y <= endYear; y += 1) {
        add(out, new Date(y, 0, 1), "New Year's Day");
        add(out, nthWeekdayOfMonth(y, 0, 1, 3), 'Martin Luther King Jr. Day');
        add(out, nthWeekdayOfMonth(y, 1, 1, 3), "Presidents' Day");
        add(out, lastWeekdayOfMonth(y, 4, 1), 'Memorial Day');
        add(out, new Date(y, 5, 19), 'Juneteenth');
        add(out, new Date(y, 6, 4), 'Independence Day');
        add(out, nthWeekdayOfMonth(y, 8, 1, 1), 'Labor Day');
        add(out, nthWeekdayOfMonth(y, 9, 1, 2), 'Columbus Day');
        add(out, new Date(y, 10, 11), 'Veterans Day', false);
        add(out, nthWeekdayOfMonth(y, 10, 4, 4), 'Thanksgiving');
        add(out, new Date(y, 11, 25), 'Christmas Day');
        add(out, nthWeekdayOfMonth(y, 4, 0, 2), "Mother's Day", false);
        add(out, nthWeekdayOfMonth(y, 5, 0, 3), "Father's Day", false);
        add(out, new Date(y, 1, 14), "Valentine's Day", false);
        add(out, new Date(y, 9, 31), 'Halloween', false);
    }
    return out;
}

export function holidaysForRange(start: Date, end: Date): Record<string, string> {
    const map = buildUsHolidays(start.getFullYear() - 1, end.getFullYear() + 1);
    return map;
}
