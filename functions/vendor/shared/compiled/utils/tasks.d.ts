import type { HouseholdTask, TaskPriority, TaskRecurrence } from '../domain/types.js';
export declare function dateKeyInTimeZone(date: Date, timeZone: string): string;
/** Converts a household-local wall-clock time to UTC without relying on the host machine timezone. */
export declare function zonedDateTimeToUtc(dateKey: string, time: string, timeZone: string): Date;
export declare function taskDueAt(dateKey: string, time: string | null | undefined, timeZone: string): Date;
export declare function isTaskOverdue(task: Pick<HouseholdTask, 'status' | 'dueDate' | 'dueTime' | 'dueAt' | 'isDeleted'>, now?: Date, timeZone?: string): boolean;
export declare function isTaskDueToday(task: Pick<HouseholdTask, 'dueDate' | 'isDeleted'>, now?: Date, timeZone?: string): boolean;
export declare function compareTaskPriority(left: TaskPriority, right: TaskPriority): number;
export declare function nextTaskRecurrenceDate(currentDate: string, recurrence: Pick<TaskRecurrence, 'frequency' | 'interval' | 'daysOfWeek' | 'customUnit' | 'endType' | 'untilDateKey' | 'maxOccurrences'>, nextOccurrenceNumber: number): string | null;
export declare function taskReminderAt(dueAt: Date, offsetMinutes: number | null | undefined): Date | null;
export declare function taskReminderStatesAfterRestore(task: Pick<HouseholdTask, 'status' | 'reminderAt' | 'dueAt'>, now?: Date): {
    reminderState: 'PENDING' | 'CANCELLED' | null;
    overdueReminderState: 'PENDING' | 'CANCELLED' | null;
};
//# sourceMappingURL=tasks.d.ts.map