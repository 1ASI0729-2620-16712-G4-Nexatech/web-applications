export function localDate(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function isPastDate(value, today = localDate()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return true;
    const parsed = new Date(`${value}T12:00:00`);
    return Number.isNaN(parsed.getTime()) || localDate(parsed) !== value || value < today;
}
