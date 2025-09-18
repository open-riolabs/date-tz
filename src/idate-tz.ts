import { TimezoneOffset } from "./timezones";

/**
 * Represents a date with timezone information and related operations.
 */
export interface IDateTz {
  /** The timestamp in milliseconds since the Unix epoch. */
  timestamp: number;
  /** The timezone identifier (e.g., 'America/New_York'). */
  timezone?: string;
  /** The timezone offset information. */
  readonly timezoneOffset?: TimezoneOffset;
  /**
   * Compares this date with another IDateTz.
   * @param other The other IDateTz to compare with.
   * @returns A negative number if this is less, zero if equal, positive if greater.
   */
  compare?(other: IDateTz): number;
  /**
   * Checks if this date is comparable with another IDateTz.
   * @param other The other IDateTz to check.
   * @returns True if comparable, false otherwise.
   */
  isComparable?(other: IDateTz): boolean;
  /**
   * Converts the date to a string representation.
   * @param pattern Optional formatting pattern.
   * @param locale Optional locale string.
   * @returns The formatted date string.
   */
  toString?(pattern?: string, locale?: string): string;
  /**
   * Adds a value to the specified unit of time.
   * @param value The amount to add.
   * @param unit The unit of time.
   * @returns A new IDateTz with the added value.
   */
  add?(value: number, unit: 'minute' | 'hour' | 'day' | 'month' | 'year'): IDateTz;
  /**
   * Sets the specified unit of time to a value.
   * @param value The value to set.
   * @param unit The unit of time.
   * @returns A new IDateTz with the set value.
   */
  set?(value: number, unit: 'year' | 'month' | 'day' | 'hour' | 'minute'): IDateTz;
  /**
   * Adds a value to the specified unit of time.
   * @param value The amount to add.
   * @param unit The unit of time.
   * @returns A new IDateTz with the added value.
   */
  add?(value: number, unit: 'year' | 'month' | 'day' | 'hour' | 'minute'): IDateTz;
  /**
   * Clones the date to a different timezone.
   * @param tz The target timezone identifier.
   * @returns A new IDateTz in the specified timezone.
   */
  cloneToTimezone?(tz: string): IDateTz;
  /** Indicates if the date is in daylight saving time. */
  readonly isDst?: boolean;
  /** The year component of the date. */
  readonly year?: number;
  /** The month component of the date (1-12). */
  readonly month?: number;
  /** The day component of the date (1-31). */
  readonly day?: number;
  /** The hour component of the date (0-23). */
  readonly hour?: number;
  /** The minute component of the date (0-59). */
  readonly minute?: number;
  /** The day of the week (0-6, where 0 is Sunday). */
  readonly dayOfWeek?: number;
}
