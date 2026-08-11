import { canonicalLink, etc } from "./canonical-link";
import { getOffsetSeconds } from "./helpers";
import { DateParts, IDateTz } from "./interfaces";
import { getTzProvider } from "./tz-provider";

const MS_PER_MINUTE = 60000;
const MS_PER_HOUR = 3600000;
const MS_PER_DAY = 86400000;

// Epoch time constants
const epochYear = 1970;
const daysPerMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

function daysInYearOf(year: number): number {
  return isLeap(year) ? 366 : 365;
}

function daysInMonthOf(year: number, month: number): number {
  return month === 1 && isLeap(year) ? 29 : daysPerMonth[month];
}

const BEFORE_EPOCH = 'Dates before 1970-01-01 are not supported';

/**
 * The one vocabulary both `toString` and `parse` speak. Longer tokens come
 * first so `YYYY` is never read as `YY` followed by a stray `YY`.
 *
 * Formatting and parsing used to keep separate lists, which let `toString`
 * emit tokens `parse` did not recognise: the round trip then silently
 * dropped a component instead of failing.
 */
const FORMAT_TOKENS = 'YYYY|yyyy|YY|yy|MM|LM|SM|DD|HH|hh|mm|ss|aa|AA|WS|WL|tz';

/**
 * What each token consumes when parsing. Text tokens are matched so the
 * rest of the pattern stays aligned, but contribute nothing: a weekday is
 * implied by the date, and the zone arrives as an argument.
 */
const TOKEN_MATCHERS: Record<string, string> = {
  YYYY: '(\\d{4})', yyyy: '(\\d{4})',
  YY: '(\\d{2})', yy: '(\\d{2})',
  MM: '(\\d{2})', DD: '(\\d{2})',
  HH: '(\\d{2})', hh: '(\\d{2})',
  mm: '(\\d{2})', ss: '(\\d{2})',
  aa: '([AaPp][Mm])', AA: '([AaPp][Mm])',
  WS: '(\\p{L}+\\.?)', WL: '(\\p{L}+)',
  tz: '([A-Za-z0-9_+/-]+)',
};

/**
 * Month names are the one thing `parse` cannot read back: resolving them
 * needs the locale they were written in, and `parse` is not given one.
 * Failing loudly beats guessing at a language.
 */
const UNPARSEABLE_TOKENS = new Set(['LM', 'SM']);

/** Escapes the literal text between tokens for use inside a RegExp. */
function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * A pattern compiled into something that can read a date string back:
 * an anchored RegExp, and the tokens its capture groups correspond to.
 */
interface CompiledPattern {
  regex: RegExp;
  tokens: string[];
}

/**
 * Splits a millisecond count since the epoch into calendar components.
 * The library models instants from 1970-01-01 onwards only, so negative
 * values are rejected rather than silently yielding negative components.
 */
function decompose(ms: number): DateParts {
  if (!Number.isFinite(ms)) throw new Error(`Invalid timestamp: ${ms}`);
  if (ms < 0) throw new Error(BEFORE_EPOCH);

  let remainingMs = ms;
  let days = Math.floor(remainingMs / MS_PER_DAY);
  remainingMs %= MS_PER_DAY;
  const hour = Math.floor(remainingMs / MS_PER_HOUR);
  remainingMs %= MS_PER_HOUR;
  const minute = Math.floor(remainingMs / MS_PER_MINUTE);
  const second = Math.floor((remainingMs % MS_PER_MINUTE) / 1000);
  const millisecond = remainingMs % 1000;

  let year = epochYear;
  while (days >= daysInYearOf(year)) {
    days -= daysInYearOf(year);
    year++;
  }

  let month = 0;
  while (days >= daysInMonthOf(year, month)) {
    days -= daysInMonthOf(year, month);
    month++;
  }

  return { year, month, day: days + 1, hour, minute, second, millisecond };
}

/**
 * Carries over out-of-range components, in both directions. Handling
 * underflow is what makes negative arguments to add() land on the right
 * calendar date instead of clamping at the start of the year.
 */
function normalize(parts: DateParts): DateParts {
  parts.second += Math.floor(parts.millisecond / 1000);
  parts.millisecond = ((parts.millisecond % 1000) + 1000) % 1000;

  parts.minute += Math.floor(parts.second / 60);
  parts.second = ((parts.second % 60) + 60) % 60;

  parts.hour += Math.floor(parts.minute / 60);
  parts.minute = ((parts.minute % 60) + 60) % 60;

  parts.day += Math.floor(parts.hour / 24);
  parts.hour = ((parts.hour % 24) + 24) % 24;

  // Months must settle before days, since the length of a month depends on it.
  parts.year += Math.floor(parts.month / 12);
  parts.month = ((parts.month % 12) + 12) % 12;

  while (parts.day > daysInMonthOf(parts.year, parts.month)) {
    parts.day -= daysInMonthOf(parts.year, parts.month);
    parts.month++;
    if (parts.month > 11) {
      parts.month = 0;
      parts.year++;
    }
  }

  while (parts.day < 1) {
    parts.month--;
    if (parts.month < 0) {
      parts.month = 11;
      parts.year--;
    }
    parts.day += daysInMonthOf(parts.year, parts.month);
  }

  return parts;
}

/** Rebuilds a millisecond count since the epoch from calendar components. */
function compose(parts: DateParts): number {
  if (parts.year < epochYear) throw new Error(BEFORE_EPOCH);

  let totalMs = 0;
  for (let y = epochYear; y < parts.year; y++) {
    totalMs += daysInYearOf(y) * MS_PER_DAY;
  }
  for (let m = 0; m < parts.month; m++) {
    totalMs += daysInMonthOf(parts.year, m) * MS_PER_DAY;
  }
  totalMs += (parts.day - 1) * MS_PER_DAY;
  totalMs += parts.hour * MS_PER_HOUR;
  totalMs += parts.minute * MS_PER_MINUTE;
  totalMs += parts.second * 1000;
  totalMs += parts.millisecond;

  if (totalMs < 0) throw new Error(BEFORE_EPOCH);
  return totalMs;
}

/**
 * Represents a date and time with a specific timezone.
 *
 * Arithmetic (`add`, `set`) operates on the UTC timestamp; reading
 * (`toString`, the component getters) renders the local wall clock of
 * `timezone`. Offset and DST are re-resolved whenever the instant or the
 * zone changes, so a read always reflects the current state.
 */
export class DateTz implements IDateTz {

  private _timestamp: number;
  private _timezone: string;
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
    const timestamp = typeof value === 'object' ? value.timestamp : value;
    const timezone = typeof value === 'object' ? value.timezone : tz;
    // Assign the zone through the private field: the timestamp setter below
    // performs the single offset resolution once both are in place.
    this._timezone = DateTz.normalizeTimeZone(timezone);
    this.timestamp = timestamp;
  }

  /**
   * The timestamp in milliseconds since the Unix epoch. Assigning to it
   * re-resolves the timezone offset and DST state for the new instant.
   */
  get timestamp(): number {
    return this._timestamp;
  }

  set timestamp(value: number) {
    if (!Number.isFinite(value)) throw new Error(`Invalid timestamp: ${value}`);
    if (value < 0) throw new Error(BEFORE_EPOCH);
    this._timestamp = value;
    this.resolveOffset();
  }

  /**
   * The timezone of the date. Assigning to it normalizes the identifier and
   * re-resolves the offset and DST state, preserving the absolute instant.
   */
  get timezone(): string {
    return this._timezone;
  }

  set timezone(tz: string) {
    this._timezone = DateTz.normalizeTimeZone(tz);
    this.resolveOffset();
  }

  /** Re-resolves offset and DST for the current instant and zone. */
  private resolveOffset(): void {
    if (this._timestamp === undefined || this._timezone === undefined) return;
    const tzOffset = getTzProvider().offsetAt(this._timestamp, this._timezone);
    this._timezoneOffset = Math.round(tzOffset.offset * 60 * 1000);
    this._isDst = tzOffset.isDst;
  }

  /** The calendar components of this instant, local or UTC. */
  private parts(local: boolean): DateParts {
    return decompose(this._timestamp + (local ? this._timezoneOffset : 0));
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
    if (!pattern) pattern = DateTz.defaultFormat;

    const { year, month, day, hour, minute, second } = this.parts(true);

    const pm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12; // Convert to 12-hour format

    if (!locale) locale = 'en';
    // Month and weekday names are read off the wall clock this instance has
    // already resolved, rendered as UTC — not by handing Intl the zone and
    // letting it convert a second time. Those two agree only while the
    // offsets agree, and a custom TzProvider is free to disagree with the
    // runtime: the numeric tokens would follow the provider while the names
    // followed Intl, and a single toString() could name the wrong weekday
    // for the date beside it.
    const wallClock = this._timestamp + this._timezoneOffset;
    let formatterTzLong = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', month: 'long', weekday: 'long' });
    let formatterTzShort = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', month: 'short', weekday: 'short' });

    // Map components to pattern tokens
    const tokens: Record<string, any> = {
      YYYY: year,
      YY: String(year).slice(-2),
      yyyy: year.toString(),
      yy: String(year).slice(-2),
      MM: String(month + 1).padStart(2, '0'),
      LM: formatterTzLong.formatToParts(wallClock).find(o => o.type === 'month').value,
      SM: formatterTzShort.formatToParts(wallClock).find(o => o.type === 'month').value,
      DD: String(day).padStart(2, '0'),
      HH: String(hour).padStart(2, '0'),
      mm: String(minute).padStart(2, '0'),
      ss: String(second).padStart(2, '0'),
      aa: pm.toLowerCase(),
      AA: pm,
      hh: hour12.toString().padStart(2, '0'),
      tz: this.timezone,
      WS: formatterTzShort.formatToParts(wallClock).find(o => o.type === 'weekday').value,
      WL: formatterTzLong.formatToParts(wallClock).find(o => o.type === 'weekday').value
    };

    // Replace pattern tokens with actual values
    return pattern.replace(new RegExp(FORMAT_TOKENS, 'g'), (match) => tokens[match]);
  }

  /**
 * Adds a specified amount of time to the DateTz instance.
 * Arithmetic is performed on the UTC timestamp.
 * @param value - The amount of time to add. May be negative.
 * @param unit - The unit of time.
 * @returns The updated DateTz instance.
 * @throws Error if the unit is unsupported.
 */
  add(value: number, unit: 'millisecond' | 'second' | 'minute' | 'hour' | 'day' | 'month' | 'year'): this {
    if (!Number.isFinite(value)) throw new Error(`Invalid value: ${value}`);

    const parts = decompose(this._timestamp);

    switch (unit) {
      case 'millisecond':
        parts.millisecond += value;
        break;
      case 'second':
        parts.second += value;
        break;
      case 'minute':
        parts.minute += value;
        break;
      case 'hour':
        parts.hour += value;
        break;
      case 'day':
        parts.day += value;
        break;
      case 'month':
        parts.month += value;
        break;
      case 'year':
        parts.year += value;
        break;
      default:
        throw new Error(`Unsupported unit: ${unit}`);
    }

    this.timestamp = compose(normalize(parts));
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
    // Construct directly in the target zone so the constructor computes
    // the right _timezoneOffset / _isDst from the start.
    return new DateTz(this.timestamp, DateTz.normalizeTimeZone(tz));
  }

  /**
 * Sets the timezone of the DateTz instance, recalculating the offset and DST status.
 * The absolute point in time (UTC timestamp) is preserved.
 * @param tz - The target timezone identifier (IANA format).
 * @returns The updated DateTz instance.
 * @throws Error if the timezone is invalid.
 */
  setTimezone(tz: string): this {
    // The setter normalizes the identifier and re-resolves offset and DST,
    // so transitions (e.g. CET -> CEST) are handled automatically.
    this.timezone = tz;
    return this;
  }

  /**
   * Strips seconds and milliseconds from the timestamp.
   * @returns The updated DateTz instance.
   */
  public stripSecMillis(): this {
    const parts = decompose(this._timestamp);
    parts.second = 0;
    parts.millisecond = 0;
    this.timestamp = compose(parts);
    return this;
  }

  /**
  * Sets a specific component of the date or time.
  * The component is applied to the UTC timestamp.
  * @param value - The value to set.
  * @param unit - The unit to set.
  * @returns The updated DateTz instance.
  * @throws Error if the unit is unsupported.
  */
  set(value: number, unit: 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second' | 'millisecond'): this {

    if (unit === 'month' && (value < 1 || value > 12)) throw new Error(`Invalid month: ${value}`);
    if (unit === 'day' && (value < 1 || value > 31)) throw new Error(`Invalid day: ${value}`);
    if (unit === 'hour' && (value < 0 || value > 23)) throw new Error(`Invalid hour: ${value}`);
    if (unit === 'minute' && (value < 0 || value > 59)) throw new Error(`Invalid minute: ${value}`);
    if (unit === 'second' && (value < 0 || value > 59)) throw new Error(`Invalid second: ${value}`);
    if (unit === 'millisecond' && (value < 0 || value > 999)) throw new Error(`Invalid millisecond: ${value}`);

    const parts = decompose(this._timestamp);

    switch (unit) {
      case 'year':
        parts.year = value;
        break;
      case 'month':
        parts.month = value - 1;
        break;
      case 'day':
        parts.day = value;
        break;
      case 'hour':
        parts.hour = value;
        break;
      case 'minute':
        parts.minute = value;
        break;
      case 'second':
        parts.second = value;
        break;
      case 'millisecond':
        parts.millisecond = value;
        break;
      default:
        throw new Error(`Unsupported unit: ${unit}`);
    }

    this.timestamp = compose(normalize(parts));
    return this;
  }

  /**
  * Gets the year component of the date.
  */
  get year() {
    return this.parts(true).year;
  }

  /**
  * Gets the year UTC component of the date.
  */
  get yearUTC() {
    return this.parts(false).year;
  }

  /**
  * Gets the month component of the date (zero-based, 0 = January).
  */
  get month() {
    return this.parts(true).month;
  }

  /**
  * Gets the month UTC component of the date (zero-based, 0 = January).
  */
  get monthUTC() {
    return this.parts(false).month;
  }

  /**
   * Gets the day component of the date.
   */
  get day() {
    return this.parts(true).day;
  }

  /**
  * Gets the day UTC component of the date.
  */
  get dayUTC() {
    return this.parts(false).day;
  }

  /**
  * Gets the hour component of the time.
  */
  get hour() {
    return this.parts(true).hour;
  }

  /**
  * Gets the hour UTC component of the time.
  */
  get hourUTC() {
    return this.parts(false).hour;
  }

  /**
  * Gets the minute component of the time.
  */
  get minute() {
    return this.parts(true).minute;
  }

  /**
  * Gets the minute UTC component of the time.
  */
  get minuteUTC() {
    return this.parts(false).minute;
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
   * Gets the timezone offset in milliseconds.
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
    return isLeap(this.year);
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
    tz = DateTz.normalizeTimeZone(tz);

    const { regex, tokens } = DateTz.compilePattern(pattern);

    if (tokens.includes('hh') && !tokens.includes('aa') && !tokens.includes('AA')) {
      throw new Error('AM/PM marker (aa or AA) is required when using 12-hour format (hh)');
    }

    const match = regex.exec(dateString);
    if (!match) {
      throw new Error(`Date string "${dateString}" does not match pattern "${pattern}"`);
    }

    // Capture groups follow the tokens in order, so the two zip together.
    const captured: Record<string, string> = {};
    tokens.forEach((token, i) => { captured[token] = match[i + 1]; });

    const num = (token: string): number | undefined =>
      captured[token] === undefined ? undefined : parseInt(captured[token], 10);

    // A pattern that carries no year at all still parses; it just lands on
    // the epoch year, as every other missing component lands on its floor.
    let year = num('YYYY') ?? num('yyyy');
    if (year === undefined) {
      const twoDigit = num('YY') ?? num('yy');
      // Two-digit years run 1970..2069: the window starts where this
      // library's supported range does.
      if (twoDigit !== undefined) year = twoDigit < 70 ? 2000 + twoDigit : 1900 + twoDigit;
    }

    let hour: number;
    const hour12 = num('hh');
    if (hour12 !== undefined) {
      const marker = (captured['AA'] ?? captured['aa'] ?? '').toUpperCase();
      const isPm = marker === 'PM';
      // 12 AM -> 0, 12 PM -> 12, otherwise hh or hh+12
      if (hour12 === 12) hour = isPm ? 12 : 0;
      else hour = isPm ? hour12 + 12 : hour12;
    } else {
      hour = num('HH') ?? 0;
    }

    let timestamp = compose({
      year: year ?? epochYear,
      month: (num('MM') ?? 1) - 1, // Months are zero-based
      day: num('DD') ?? 1,
      hour,
      minute: num('mm') ?? 0,
      second: num('ss') ?? 0,
      millisecond: 0,
    });

    const offset = getOffsetSeconds(timestamp, tz) * 1000;
    timestamp -= offset;
    const date = new DateTz(timestamp, tz);
    return date;
  }

  private static _patternCache = new Map<string, CompiledPattern>();

  /**
   * Compiles a format pattern into an anchored RegExp that reads a date
   * string back.
   *
   * Parsing walks the pattern and the string together rather than reading
   * each component at the offset its token sits at. Positional reads only
   * hold while every token is exactly as wide as the text it produced, so a
   * single variable-width name — a month, a weekday, a zone id — used to
   * shift every component after it and yield a wrong date, or a complaint
   * about the epoch, rather than a word about the pattern.
   *
   * @param pattern - The format pattern to compile.
   * @throws Error if the pattern carries a token that cannot be read back.
   */
  private static compilePattern(pattern: string): CompiledPattern {
    const cached = DateTz._patternCache.get(pattern);
    if (cached) return cached;

    const tokens: string[] = [];
    const finder = new RegExp(FORMAT_TOKENS, 'g');
    let source = '^';
    let literalStart = 0;
    let match: RegExpExecArray | null;

    while ((match = finder.exec(pattern)) !== null) {
      const token = match[0];
      if (UNPARSEABLE_TOKENS.has(token)) {
        throw new Error(`Pattern token '${token}' cannot be parsed: month names depend on a locale that parse() does not receive. Use 'MM' instead.`);
      }
      source += escapeRegExp(pattern.slice(literalStart, match.index));
      source += TOKEN_MATCHERS[token];
      tokens.push(token);
      literalStart = match.index + token.length;
    }

    source += escapeRegExp(pattern.slice(literalStart)) + '$';

    const compiled: CompiledPattern = { regex: new RegExp(source, 'u'), tokens };
    DateTz._patternCache.set(pattern, compiled);
    return compiled;
  }

  /**
   * Gets the current date and time as a DateTz instance.
   * @param tz - The timezone identifier (optional). Defaults to 'Etc/UTC'.
   * @returns A new DateTz instance representing the current date and time.
   */
  static now(tz?: string): DateTz {
    return new DateTz(Date.now(), DateTz.normalizeTimeZone(tz));
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

  private static _supportedSet: Set<string>;
  private static _linkForward: Map<string, string>;
  private static _linkReverse: Map<string, string>;
  private static _intlAccepts = new Map<string, boolean>();

  /**
   * Resolves a timezone identifier to one the runtime actually supports,
   * following canonical links in both directions. Every entry point goes
   * through here, so two instances of the same zone always agree on the
   * identifier and stay comparable.
   * @param timezone - The identifier to resolve. Defaults to 'Etc/UTC'.
   * @throws Error if the timezone cannot be resolved.
   */
  private static normalizeTimeZone(timezone?: string): string {
    if (!timezone) return 'Etc/UTC';
    if (timezone === 'UTC') return 'Etc/UTC';

    if (!DateTz._supportedSet) {
      DateTz._supportedSet = new Set(DateTz.supportedTimeZones());
      DateTz._linkForward = new Map(Object.entries(canonicalLink));
      DateTz._linkReverse = new Map();
      for (const [alias, canonical] of DateTz._linkForward) {
        if (!DateTz._linkReverse.has(canonical)) DateTz._linkReverse.set(canonical, alias);
      }
    }

    if (DateTz._supportedSet.has(timezone)) return timezone;

    const linked = DateTz._linkForward.get(timezone);
    if (linked && DateTz._supportedSet.has(linked)) return linked;

    const alias = DateTz._linkReverse.get(timezone);
    if (alias && DateTz._supportedSet.has(alias)) return alias;

    // Intl.supportedValuesOf omits several identifiers that
    // Intl.DateTimeFormat still resolves (legacy links such as
    // America/Fort_Wayne). Keep those rather than rejecting a zone the
    // runtime can actually handle.
    if (DateTz.intlAccepts(timezone)) return timezone;

    throw new Error(`Invalid timezone: ${timezone}`);
  }

  /** Whether the runtime's Intl implementation resolves this identifier. */
  private static intlAccepts(timezone: string): boolean {
    let accepted = DateTz._intlAccepts.get(timezone);
    if (accepted === undefined) {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: timezone });
        accepted = true;
      } catch {
        accepted = false;
      }
      DateTz._intlAccepts.set(timezone, accepted);
    }
    return accepted;
  }
}
