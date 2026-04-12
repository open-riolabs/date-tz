import { canonicalLink, etc } from "./canonical-link";
import { getOffsetSeconds, tzDiscover, } from "./helpers";
import { IDateTz } from "./idate-tz";

const MS_PER_MINUTE = 60000;
const MS_PER_HOUR = 3600000;
const MS_PER_DAY = 86400000;

// Epoch time constants
const epochYear = 1970;
const daysPerMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * Represents a date and time with a specific timezone.
 */
export class DateTz implements IDateTz {

  /**
 * The timestamp in milliseconds since the Unix epoch.
 */
  timestamp: number;

  /**
   * The timezone of the date.
   */
  timezone: string;

  private _timezoneOffset: number;
  private _isDst: boolean;

  /**
   * The default date format used when converting to string.
   */
  public static defaultFormat = 'YYYY-MM-DD HH:mm:ss';

  /**
 * Creates an instance of DateTz.
 * @param value - The timestamp or an object implementing IDateTz.
 * @param tz - The timezone identifier (optional).
 */
  constructor(value: IDateTz);
  constructor(value: number, tz?: string);
  constructor(value: number | IDateTz, tz?: string) {
    if (typeof value === 'object') {
      this.timestamp = value.timestamp;
      this.timezone = value.timezone || 'Etc/UTC';
      if (this.timezone === 'UTC') this.timezone = 'Etc/UTC';
      if (!DateTz.isValidTimeZone(this.timezone)) {
        throw new Error(`Invalid timezone: ${value.timezone}`);
      }
    } else {
      this.timestamp = value;
      if (tz === 'UTC') tz = 'Etc/UTC';
      this.timezone = tz || 'Etc/UTC';
      if (!DateTz.isValidTimeZone(this.timezone)) {
        throw new Error(`Invalid timezone: ${tz}`);
      }
    }
    const tzOffset = tzDiscover(this.timestamp, this.timezone);
    this._timezoneOffset = tzOffset.offset * 60 * 1000;
    this._isDst = tzOffset.isDst;
  }

  /**
   * Checks if this DateTz instance is comparable with another.
   * @param other - The other DateTz instance to check.
   * @returns True if the timezones are the same, otherwise false.
   */
  isComparable(other: IDateTz): boolean {
    return this.timezone === other.timezone;
  }

  /**
 * Compares this DateTz instance with another.
 * @param other - The other DateTz instance to compare with.
 * @returns The difference in timestamps.
 * @throws Error if the timezones are different.
 */
  compare(other: IDateTz): number {
    if (this.isComparable(other)) {
      return this.timestamp - other.timestamp;
    }
    throw new Error('Cannot compare dates with different timezones');
  }

  /**
 * Converts the DateTz instance to a string representation.
 * @param pattern - The format pattern (optional).
 * @returns The formatted date string.
 */
  toString(): string;
  toString(pattern: string): string;
  toString(pattern: string, locale: string): string;
  toString(pattern?: string, locale?: string): string {
    if (!pattern) pattern = 'YYYY-MM-DD HH:mm:ss';

    // Calculate year, month, day, hours, minutes, seconds
    const offset = this.timezoneOffset;
    let remainingMs = this.timestamp + offset;
    let year = epochYear;

    // Calculate year
    while (true) {
      const daysInYear = this._isLeapYear(year) ? 366 : 365;
      const msInYear = daysInYear * MS_PER_DAY;

      if (remainingMs >= msInYear) {
        remainingMs -= msInYear;
        year++;
      } else {
        break;
      }
    }

    // Calculate month
    let month = 0;
    while (month < 12) {
      const daysInMonth = month === 1 && this._isLeapYear(year) ? 29 : daysPerMonth[month];
      const msInMonth = daysInMonth * MS_PER_DAY;

      if (remainingMs >= msInMonth) {
        remainingMs -= msInMonth;
        month++;
      } else {
        break;
      }
    }

    // Calculate day
    const day = Math.floor(remainingMs / MS_PER_DAY) + 1;
    remainingMs %= MS_PER_DAY;

    // Calculate hour
    const hour = Math.floor(remainingMs / MS_PER_HOUR);
    remainingMs %= MS_PER_HOUR;

    // Calculate minute
    const minute = Math.floor(remainingMs / MS_PER_MINUTE);
    remainingMs %= MS_PER_MINUTE;

    // Calculate second
    const second = Math.floor(remainingMs / 1000);

    const pm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12; // Convert to 12-hour format

    if (!locale) locale = 'en';
    let formatterTzLong = new Intl.DateTimeFormat(locale, { timeZone: this.timezone, hour12: false, month: 'long', weekday: 'long' });
    let formatterTzShort = new Intl.DateTimeFormat(locale, { timeZone: this.timezone, hour12: false, month: 'short', weekday: 'short' });

    // Map components to pattern tokens
    const tokens: Record<string, any> = {
      YYYY: year,
      YY: String(year).slice(-2),
      yyyy: year.toString(),
      yy: String(year).slice(-2),
      MM: String(month + 1).padStart(2, '0'),
      LM: formatterTzLong.formatToParts(this.timestamp).find(o => o.type === 'month').value,
      SM: formatterTzShort.formatToParts(this.timestamp).find(o => o.type === 'month').value,
      DD: String(day).padStart(2, '0'),
      HH: String(hour).padStart(2, '0'),
      mm: String(minute).padStart(2, '0'),
      ss: String(second).padStart(2, '0'),
      aa: pm.toLowerCase(),
      AA: pm,
      hh: hour12.toString().padStart(2, '0'),
      tz: this.timezone,
      WS: formatterTzShort.formatToParts(this.timestamp).find(o => o.type === 'weekday').value,
      WL: formatterTzLong.formatToParts(this.timestamp).find(o => o.type === 'weekday').value
    };

    // Replace pattern tokens with actual values
    return pattern.replace(/YYYY|yyyy|YY|yy|MM|LM|SM|DD|HH|hh|mm|ss|aa|AA|WS|WL|tz/g, (match) => tokens[match]);
  }

  /**
 * Adds a specified amount of time to the DateTz instance.
 * @param value - The amount of time to add.
 * @param unit - The unit of time ('minute', 'hour', 'day', 'month', 'year').
 * @returns The updated DateTz instance.
 * @throws Error if the unit is unsupported.
 */
  add(value: number, unit: 'millisecond' | 'second' | 'minute' | 'hour' | 'day' | 'month' | 'year'): IDateTz {
    let remainingMs = this.timestamp;

    // Extract current date components
    let year = 1970;
    let days = Math.floor(remainingMs / MS_PER_DAY);
    remainingMs %= MS_PER_DAY;
    let hour = Math.floor(remainingMs / MS_PER_HOUR);
    remainingMs %= MS_PER_HOUR;
    let minute = Math.floor(remainingMs / MS_PER_MINUTE);
    let second = Math.floor((remainingMs % MS_PER_MINUTE) / 1000);
    let millisecond = remainingMs % 1000;

    // Calculate current year
    while (days >= this.daysInYear(year)) {
      days -= this.daysInYear(year);
      year++;
    }

    // Calculate current month
    let month = 0;
    while (days >= (month === 1 && this._isLeapYear(year) ? 29 : daysPerMonth[month])) {
      days -= month === 1 && this._isLeapYear(year) ? 29 : daysPerMonth[month];
      month++;
    }

    let day = days + 1;

    // Add time based on the unit
    switch (unit) {
      case 'millisecond':
        millisecond += value;
        break;
      case 'second':
        second += value;
        break;
      case 'minute':
        minute += value;
        break;
      case 'hour':
        hour += value;
        break;
      case 'day':
        day += value;
        break;
      case 'month':
        month += value;
        break;
      case 'year':
        year += value;
        break;
      default:
        throw new Error(`Unsupported unit: ${unit}`);
    }

    // Normalize overflow for minutes, hours, and days
    while (minute >= 60) {
      minute -= 60;
      hour++;
    }
    while (hour >= 24) {
      hour -= 24;
      day++;
    }

    // Normalize overflow for months and years
    while (month >= 12) {
      month -= 12;
      year++;
    }

    // Normalize day overflow
    while (day > (month === 1 && this._isLeapYear(year) ? 29 : daysPerMonth[month])) {
      day -= month === 1 && this._isLeapYear(year) ? 29 : daysPerMonth[month];
      month++;
      if (month >= 12) {
        month = 0;
        year++;
      }
    }

    // Convert back to timestamp
    const newTimestamp = (() => {
      let totalMs = 0;

      // Add years
      for (let y = 1970; y < year; y++) {
        totalMs += this.daysInYear(y) * MS_PER_DAY;
      }

      // Add months
      for (let m = 0; m < month; m++) {
        totalMs += (m === 1 && this._isLeapYear(year) ? 29 : daysPerMonth[m]) * MS_PER_DAY;
      }

      // Add days, hours, minutes, and seconds
      totalMs += (day - 1) * MS_PER_DAY;
      totalMs += hour * MS_PER_HOUR;
      totalMs += minute * MS_PER_MINUTE;
      totalMs += second * 1000;
      totalMs += millisecond;

      return totalMs;
    })();

    this.timestamp = newTimestamp;
    return this;
  }

  /**
   * Clones the DateTz instance into a different timezone.
   * The clone represents the same absolute instant, displayed in the target
   * zone with correctly recomputed offset and DST state.
   * @param tz - The target timezone identifier.
   * @returns A new DateTz instance in the target timezone.
   * @throws Error if the timezone is invalid.
   */
  cloneToTimezone(tz: string): DateTz {
    if (!tz) throw new Error(`Invalid timezone: ${tz}`);
    if (tz === 'UTC') tz = 'Etc/UTC';
    tz = DateTz.fallbackTimeZone(tz);
    if (!DateTz.isValidTimeZone(tz)) {
      throw new Error(`Invalid timezone: ${tz}`);
    }
    // Construct directly in the target zone so the constructor computes
    // the right _timezoneOffset / _isDst from the start.
    return new DateTz(this.timestamp, tz);
  }

  /**
 * Sets the timezone of the DateTz instance, recalculating the offset and DST status.
 * The absolute point in time (UTC timestamp) is preserved.
 * @param tz - The target timezone identifier (IANA format).
 * @returns The updated DateTz instance.
 * @throws Error if the timezone is invalid.
 */
  setTimezone(tz: string): IDateTz {
    if (!tz) throw new Error(`Invalid timezone: ${tz}`);
    if (tz === 'UTC') tz = 'Etc/UTC';
    tz = DateTz.fallbackTimeZone(tz);
    if (!DateTz.isValidTimeZone(tz)) {
      throw new Error(`Invalid timezone: ${tz}`);
    }

    this.timezone = tz;

    // Recalculate offset and DST for the current timestamp in the new timezone.
    // tzDiscover uses Intl internally to resolve the correct UTC offset and DST
    // flag, so transitions (e.g. CET → CEST) are handled automatically.
    const tzOffset = tzDiscover(this.timestamp, this.timezone);
    this._timezoneOffset = tzOffset.offset * 60 * 1000;
    this._isDst = tzOffset.isDst;

    return this;
  }

  /**
   * Strips seconds and milliseconds from the timestamp.
   * @param timestamp - The original timestamp.
   * @returns The timestamp without seconds and milliseconds.
   */
  public stripSecMillis(): IDateTz {
    // Calculate the time components
    const days = Math.floor(this.timestamp / MS_PER_DAY);
    const remainingAfterDays = this.timestamp % MS_PER_DAY;

    const hours = Math.floor(remainingAfterDays / MS_PER_HOUR);
    const remainingAfterHours = remainingAfterDays % MS_PER_HOUR;

    const minutes = Math.floor(remainingAfterHours / MS_PER_MINUTE);

    // Reconstruct the timestamp without seconds and milliseconds
    this.timestamp = days * MS_PER_DAY + hours * MS_PER_HOUR + minutes * MS_PER_MINUTE;
    return this;
  }

  /**
  * Sets a specific component of the date or time.
  * @param value - The value to set.
  * @param unit - The unit to set ('year', 'month', 'day', 'hour', 'minute').
  * @returns The updated DateTz instance.
  * @throws Error if the unit is unsupported.
  */
  set(value: number, unit: 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second' | 'millisecond') {

    if (unit === 'month' && (value < 1 || value > 12)) throw new Error(`Invalid month: ${value}`);
    if (unit === 'day' && (value < 1 || value > 31)) throw new Error(`Invalid day: ${value}`);
    if (unit === 'hour' && (value < 0 || value > 23)) throw new Error(`Invalid hour: ${value}`);
    if (unit === 'minute' && (value < 0 || value > 59)) throw new Error(`Invalid minute: ${value}`);
    if (unit === 'second' && (value < 0 || value > 59)) throw new Error(`Invalid second: ${value}`);
    if (unit === 'millisecond' && (value < 0 || value > 999)) throw new Error(`Invalid millisecond: ${value}`);

    let remainingMs = this.timestamp;

    // Extract current date components
    let year = 1970;
    let days = Math.floor(remainingMs / MS_PER_DAY);
    remainingMs %= MS_PER_DAY;
    let hour = Math.floor(remainingMs / MS_PER_HOUR);
    remainingMs %= MS_PER_HOUR;
    let minute = Math.floor(remainingMs / MS_PER_MINUTE);
    let second = Math.floor((remainingMs % MS_PER_MINUTE) / 1000);
    let millisecond = remainingMs % 1000;

    // Calculate current year
    while (days >= this.daysInYear(year)) {
      days -= this.daysInYear(year);
      year++;
    }

    // Calculate current month
    let month = 0;
    while (days >= (month === 1 && this._isLeapYear(year) ? 29 : daysPerMonth[month])) {
      days -= month === 1 && this._isLeapYear(year) ? 29 : daysPerMonth[month];
      month++;
    }

    let day = days + 1;

    // Set the value based on the unit
    switch (unit) {
      case 'year':
        year = value;
        break;
      case 'month':
        month = value - 1;
        break;
      case 'day':
        day = value;
        break;
      case 'hour':
        hour = value;
        break;
      case 'minute':
        minute = value;
        break;
      case 'second':
        second = value;
        break;
      case 'millisecond':
        millisecond = value;
        break;
      default:
        throw new Error(`Unsupported unit: ${unit}`);
    }

    // Normalize overflow for months and years
    while (month >= 12) {
      month -= 12;
      year++;
    }

    // Normalize day overflow
    while (day > (month === 1 && this._isLeapYear(year) ? 29 : daysPerMonth[month])) {
      day -= month === 1 && this._isLeapYear(year) ? 29 : daysPerMonth[month];
      month++;
      if (month >= 12) {
        month = 0;
        year++;
      }
    }

    // Convert back to timestamp
    const newTimestamp = (() => {
      let totalMs = 0;

      // Add years
      for (let y = 1970; y < year; y++) {
        totalMs += this.daysInYear(y) * MS_PER_DAY;
      }

      // Add months
      for (let m = 0; m < month; m++) {
        totalMs += (m === 1 && this._isLeapYear(year) ? 29 : daysPerMonth[m]) * MS_PER_DAY;
      }

      // Add days, hours, minutes, and seconds
      totalMs += (day - 1) * MS_PER_DAY;
      totalMs += hour * MS_PER_HOUR;
      totalMs += minute * MS_PER_MINUTE;
      totalMs += second * 1000;
      totalMs += millisecond;

      return totalMs;
    })();

    this.timestamp = newTimestamp;
    return this;
  }

  /**
  * Gets the year component of the date.
  */
  get year() {
    return this._year(true);
  }

  /**
  * Gets the year UTC component of the date.
  */
  get yearUTC() {
    return this._year(false);
  }

  /**
  * Gets the month component of the date.
  */
  get month() {
    return this._month(true);
  }

  /**
  * Gets the month UTC component of the date.
  */
  get monthUTC() {
    return this._month(false);
  }

  /**
   * Gets the day component of the date.
   */
  get day() {
    return this._day(true);
  }

  /**
  * Gets the day UTC component of the date.
  */
  get dayUTC() {
    return this._day(false);
  }

  /**
  * Gets the hour component of the time.
  */
  get hour() {
    return this._hour(true);
  }

  /**
  * Gets the hour UTC component of the time.
  */
  get hourUTC() {
    return this._hour(false);
  }

  /**
  * Gets the minute component of the time.
  */
  get minute() {
    return this._minute(true);
  }

  /**
  * Gets the minute UTC component of the time.
  */
  get minuteUTC() {
    return this._minute(false);
  }

  /**
   * Gets the day of the week.
   */
  get dayOfWeek(): number {
    return this._dayOfWeek(true);
  }

  /**
  * Gets the day UTC of the week.
  */
  get dayOfWeekUTC(): number {
    return this._dayOfWeek(false);
  }

  /**
   * Gets the timezone offset in seconds.
   */
  get timezoneOffset() {
    return this._timezoneOffset;
  }

  /**
   * Gets the daylight saving time status.
   */
  get isDst() {
    return this._isDst;
  }

  /**
 * Checks if the current year is a leap year.
 */
  get isLeapYear(): boolean {
    return this._isLeapYear(this.year);
  }

  /**
 * Checks if a given year is a leap year.
 * @param year - The year to check.
 * @returns True if the year is a leap year, otherwise false.
 */
  private _isLeapYear(year: number) {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  }

  /**
   * Gets the number of days in a given year.
   * @param year - The year to check.
   * @returns The number of days in the year.
   */
  private daysInYear(year: number) {
    return this._isLeapYear(year) ? 366 : 365;
  }

  private _year(local?: boolean) {
    let remainingMs = this.timestamp + (local ? this.timezoneOffset : 0);
    let year = 1970;
    let days = Math.floor(remainingMs / MS_PER_DAY);

    while (days >= this.daysInYear(year)) {
      days -= this.daysInYear(year);
      year++;
    }

    return year;
  }

  private _month(local?: boolean) {
    let remainingMs = this.timestamp + (local ? this.timezoneOffset : 0);
    let year = 1970;
    let days = Math.floor(remainingMs / MS_PER_DAY);

    while (days >= this.daysInYear(year)) {
      days -= this.daysInYear(year);
      year++;
    }

    let month = 0;
    while (days >= (month === 1 && this._isLeapYear(year) ? 29 : daysPerMonth[month])) {
      days -= month === 1 && this._isLeapYear(year) ? 29 : daysPerMonth[month];
      month++;
    }

    return month;
  }

  private _day(local?: boolean) {
    let remainingMs = this.timestamp + (local ? this.timezoneOffset : 0);
    let year = 1970;
    let days = Math.floor(remainingMs / MS_PER_DAY);

    while (days >= this.daysInYear(year)) {
      days -= this.daysInYear(year);
      year++;
    }

    let month = 0;
    while (days >= (month === 1 && this._isLeapYear(year) ? 29 : daysPerMonth[month])) {
      days -= month === 1 && this._isLeapYear(year) ? 29 : daysPerMonth[month];
      month++;
    }

    return days + 1;
  }

  private _hour(local?: boolean) {
    let remainingMs = this.timestamp + (local ? this.timezoneOffset : 0);
    remainingMs %= MS_PER_DAY;
    let hour = Math.floor(remainingMs / MS_PER_HOUR);
    return hour;
  }

  private _minute(local?: boolean) {
    let remainingMs = this.timestamp + (local ? this.timezoneOffset : 0);
    remainingMs %= MS_PER_HOUR;
    let minute = Math.floor(remainingMs / MS_PER_MINUTE);
    return minute;
  }

  private _dayOfWeek(local?: boolean) {
    // remainingMs is the instant shifted into the target (or UTC) wall clock,
    // so the UTC day-of-week of that shifted value is the answer. Using
    // getDay() here would leak the runtime's local timezone into the result.
    let remainingMs = this.timestamp + (local ? this.timezoneOffset : 0);
    const date = new Date(remainingMs);
    return date.getUTCDay();
  }

  private static _supportedTimezones: string[];
  private static _timezones: string[];

  /**
* Parses a date string into a DateTz instance.
* @param dateString - The date string to parse.
* @param pattern - The format pattern (optional).
* @param tz - The timezone identifier (optional).
* @returns A new DateTz instance.
*/
  static parse(dateString: string, pattern?: string, tz?: string): DateTz {
    if (!pattern) pattern = DateTz.defaultFormat;
    if (!tz) tz = 'Etc/UTC';
    if (tz === 'UTC') tz = 'Etc/UTC';
    tz = DateTz.fallbackTimeZone(tz);
    if (!DateTz.isValidTimeZone(tz)) {
      throw new Error(`Invalid timezone: ${tz}`);
    }
    if (pattern.includes('hh') && (!pattern.includes('aa') || !pattern.includes('AA'))) {
      throw new Error('AM/PM marker (aa or AA) is required when using 12-hour format (hh)');
    }

    const regex = /YYYY|yyyy|MM|DD|HH|hh|mm|ss|aa|AA/g;
    const dateComponents: { [key: string]: number | string; } = {
      YYYY: 1970,
      yyyy: 1970,
      MM: 0,
      DD: 0,
      HH: 0,
      hh: 0,
      aa: 'am',
      AA: "AM",
      mm: 0,
      ss: 0,
    };

    let match: RegExpExecArray | null;
    while ((match = regex.exec(pattern)) !== null) {
      const token = match[0];
      if (token === 'aa' || token === 'AA') {
        dateComponents[token] = dateString.substring(match.index, match.index + token.length);
      } else {
        const value = parseInt(dateString.substring(match.index, match.index + token.length), 10);
        dateComponents[token] = value;
      }
    }

    const year = (dateComponents.YYYY as number) || (dateComponents.yyyy as number);
    const month = (dateComponents.MM as number) - 1; // Months are zero-based
    const day = dateComponents.DD as number;
    let hour = 0;
    const ampm = (dateComponents.aa || dateComponents.AA) as string;
    if (pattern.includes('hh')) {
      const hh12 = dateComponents.hh as number;
      const isPm = ampm && ampm.toUpperCase() === 'PM';
      // 12 AM -> 0, 12 PM -> 12, otherwise hh or hh+12
      if (hh12 === 12) hour = isPm ? 12 : 0;
      else hour = isPm ? hh12 + 12 : hh12;
    } else {
      hour = dateComponents.HH as number;
    }
    const minute = dateComponents.mm as number;
    const second = dateComponents.ss as number;

    const daysInYear = (year: number) => (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0) ? 366 : 365;
    const daysInMonth = (year: number, month: number) => month === 1 && daysInYear(year) === 366 ? 29 : daysPerMonth[month];

    let timestamp = 0;

    // Add years
    for (let y = 1970; y < year; y++) {
      timestamp += daysInYear(y) * MS_PER_DAY;
    }

    // Add months
    for (let m = 0; m < month; m++) {
      timestamp += daysInMonth(year, m) * MS_PER_DAY;
    }
    // Add days, hours, minutes, and seconds
    timestamp += (day - 1) * MS_PER_DAY;
    timestamp += hour * MS_PER_HOUR;
    timestamp += minute * MS_PER_MINUTE;
    timestamp += second * 1000;

    //////////

    const offset = getOffsetSeconds(timestamp, tz) * 1000;
    timestamp -= offset;
    const date = new DateTz(timestamp, tz);
    return date;
  }

  /**
   * Gets the current date and time as a DateTz instance.
   * @param tz - The timezone identifier (optional). Defaults to 'UTC'.
   * @returns A new DateTz instance representing the current date and time.
   */
  static now(tz?: string): DateTz {
    if (!tz) tz = 'Etc/UTC';
    if (tz === 'UTC') tz = 'Etc/UTC';
    tz = DateTz.fallbackTimeZone(tz);
    if (!DateTz.isValidTimeZone(tz)) {
      throw new Error(`Invalid timezone: ${tz}`);
    }
    const date = new DateTz(Date.now(), tz);
    return date;
  }

  static timezones(): string[] {
    if (!this._timezones) {
      this._timezones = Array.from(new Set([
        ...this.supportedTimeZones(),
        ...Object.keys(canonicalLink),
        ...Object.values(canonicalLink)
      ])).sort();
    }
    return this._timezones;
  }

  static supportedTimeZones(): string[] {
    if (!this._supportedTimezones) {
      this._supportedTimezones = Array.from(new Set([
        ...etc,
        ...Intl.supportedValuesOf('timeZone')
      ]));
    }
    return this._supportedTimezones;
  }

  private static fallbackTimeZone(timezone: string): string {
    if (DateTz.supportedTimeZones().includes(timezone)) {
      return timezone;
    } else if (Object.keys(canonicalLink).includes(timezone) && DateTz.supportedTimeZones().includes(canonicalLink[timezone])) {
      return canonicalLink[timezone];
    } else if (Object.values(canonicalLink).includes(timezone) && DateTz.supportedTimeZones().includes(Object.entries(canonicalLink).find(([k, v]) => v === timezone)?.[0])) {
      return Object.entries(canonicalLink).find(([k, v]) => v === timezone)?.[0];
    } else {
      throw new Error(`Unsupported time zone: ${timezone}`);
    }
  }

  private static isValidTimeZone(timezone: string): boolean {
    return DateTz.timezones().includes(timezone);
  }
}