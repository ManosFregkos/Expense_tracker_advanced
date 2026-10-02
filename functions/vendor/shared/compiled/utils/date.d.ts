export declare function monthKey(date: Date, timeZone?: string): string;
export declare function startOfMonthUtc(year: number, monthIndex: number): Date;
/** Inclusive start and exclusive end of a calendar month in the household timezone. */
export declare function dateRangeForMonth(key: string, timeZone?: string): {
    start: Date;
    end: Date;
};
export declare function dateRangeForPreset(preset: 'THIS_MONTH' | 'LAST_MONTH' | 'LAST_3_MONTHS' | 'LAST_6_MONTHS' | 'LAST_12_MONTHS' | 'THIS_YEAR', now?: Date, timeZone?: string): {
    start: Date;
    end: Date;
};
//# sourceMappingURL=date.d.ts.map