export function normalizeSearchText(value) {
    return value
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\p{L}]+/gu, ' ')
        .trim();
}
export function buildSearchPrefixes(...values) {
    const prefixes = new Set();
    for (const value of values) {
        for (const token of normalizeSearchText(value ?? '')
            .split(' ')
            .filter(Boolean)) {
            for (let size = 1; size <= Math.min(token.length, 20); size += 1)
                prefixes.add(token.slice(0, size));
        }
    }
    return [...prefixes].slice(0, 200);
}
