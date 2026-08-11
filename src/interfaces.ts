
/**
 * The calendar components of an instant. Always relative to a wall clock
 * (UTC for the raw timestamp, or the local one once the offset is applied).
 */
export interface DateParts {
  year: number;
  /** Zero-based, 0 = January. */
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
}

/**
 * The offset and DST state of an instant in a zone.
 */
export interface TzInfo {
  /**
   * Offset east of UTC in minutes, fractional for the sub-minute offsets
   * several zones carried before 1972.
   */
  offset: number;
  /** Whether the zone's clock is shifted off its standard offset. */
  isDst: boolean;
}

/**
 * Resolves the offset and DST state of an instant in a zone.
 *
 * Resolving a UTC offset is the one thing this library cannot work out on its
 * own: it needs the IANA timezone database. By default that data comes from
 * the runtime through `Intl`, which keeps the package dependency-free and as
 * current as whatever tzdata the host happens to ship.
 *
 * That default is a trade-off rather than a law. A host pinned to an old
 * runtime, a deployment that must freeze its zone rules, or a test that needs
 * a rule the runtime has not shipped yet all want to answer the question
 * differently. Routing every lookup through a provider makes the answer
 * replaceable without touching the rest of the library.
 */
export interface TzProvider {
  /**
   * @param timestamp - The instant, in milliseconds since the Unix epoch.
   * @param timezone - The IANA timezone identifier.
   */
  offsetAt(timestamp: number, timezone: string): TzInfo;
}

/**
 * Represents a date with timezone information and related operations.
 */
export interface IDateTz {
  /** The timestamp in milliseconds since the Unix epoch. */
  timestamp: number;
  /** The timezone identifier (e.g., 'America/New_York'). */
  timezone?: string;

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
  toString?(): string;
  toString?(pattern: string): string;
  toString?(pattern: string, locale: string): string;
  /**
   * Adds a value to the specified unit of time.
   * @param value The amount to add.
   * @param unit The unit of time.
   * @returns A new IDateTz with the added value.
   */
  add?(value: number, unit: 'millisecond' | 'second' | 'minute' | 'hour' | 'day' | 'month' | 'year'): IDateTz;
  /**
   * Sets the specified unit of time to a value.
   * @param value The value to set.
   * @param unit The unit of time.
   * @returns A new IDateTz with the set value.
   */
  set?(value: number, unit: 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second' | 'millisecond'): IDateTz;
  /**
   * Clones the date to a different timezone.
   * @param tz The target timezone identifier.
   * @returns A new IDateTz in the specified timezone.
   */
  cloneToTimezone?(tz: string): IDateTz;
  /** Indicates if the date is in daylight saving time. */

  /**
 * Sets the timezone of the DateTz instance, recalculating the offset and DST status.
 * The absolute point in time (UTC timestamp) is preserved.
 * @param tz - The target timezone identifier (IANA format).
 * @returns The updated DateTz instance.
 * @throws Error if the timezone is invalid.
 */
  setTimezone?(tz: string): IDateTz;

  /**
 * Strips seconds and milliseconds from the timestamp.
 * @param timestamp - The original timestamp.
 * @returns The timestamp without seconds and milliseconds.
 */
  stripSecMillis?(): IDateTz;
  /** The timezone offset from UTC, in milliseconds. */
  readonly timezoneOffset?: number;
  /** Indicates if the date is in daylight saving time. */
  readonly isDst?: boolean;
  /** The year component of the date. */
  readonly year?: number;
  /** The month component of the date (zero-based, 0 = January). */
  readonly month?: number;
  /** The day component of the date (1-31). */
  readonly day?: number;
  /** The hour component of the date (0-23). */
  readonly hour?: number;
  /** The minute component of the date (0-59). */
  readonly minute?: number;
  /** The second component of the date (0-59). */
  readonly second?: number;
  /** The millisecond component of the date (0-999). */
  readonly millisecond?: number;
  /** The day of the week (0-6, where 0 is Sunday). */
  readonly dayOfWeek?: number;
  /** The year component of the date (UTC). */
  readonly yearUTC?: number;
  /** The month component of the date (zero-based, 0 = January, UTC). */
  readonly monthUTC?: number;
  /** The day component of the date (1-31, UTC). */
  readonly dayUTC?: number;
  /** The hour component of the date (0-23, UTC). */
  readonly hourUTC?: number;
  /** The minute component of the date (0-59, UTC). */
  readonly minuteUTC?: number;
  /** The second component of the date (0-59, UTC). */
  readonly secondUTC?: number;
  /** The millisecond component of the date (0-999, UTC). */
  readonly millisecondUTC?: number;
  /** The day of the week (0-6, where 0 is Sunday, UTC). */
  readonly dayOfWeekUTC?: number;
  /** Checks if the current year is a leap year. */
  readonly isLeapYear?: boolean;
}