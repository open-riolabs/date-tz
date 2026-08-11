const MS_PER_MINUTE = 60000;

/**
 * Any instant matching a given wall clock lies within 14 hours of it, that
 * being the widest UTC offset in use. Probing a little over a day either side
 * therefore brackets the one DST transition that could affect it, while
 * staying far too narrow to catch a second one.
 */
const PROBE_WINDOW_MS = 26 * 60 * MS_PER_MINUTE;

/**
 * Resolves the UTC offset that applies to a local wall-clock time.
 *
 * A DST transition can make a wall clock ambiguous (it happens twice, when
 * clocks go back) or non-existent (it is skipped, when clocks go forward).
 * Both resolve with the offset in effect *before* the transition, matching
 * the convention of Temporal's 'compatible' disambiguation, Luxon and
 * java.time: an ambiguous time takes its first occurrence, and a skipped
 * time shifts forward by the length of the gap. The rule is the same in
 * every zone, regardless of the sign of its offset.
 *
 * @param localAsUtc - The local wall clock, expressed as if it were UTC.
 * @param timezone - The IANA timezone identifier.
 * @returns The offset in seconds to subtract from localAsUtc for the instant.
 */
export function getOffsetSeconds(localAsUtc: number, timezone: string): number {
  if (timezone === 'UTC') return 0;

  const before = tzDiscover(localAsUtc - PROBE_WINDOW_MS, timezone).offset;
  const after = tzDiscover(localAsUtc + PROBE_WINDOW_MS, timezone).offset;

  // offset is expressed in (possibly fractional) minutes, so round to whole
  // seconds: real UTC offsets never have a sub-second component.
  if (before === after) return Math.round(before * 60);

  // A candidate offset is valid when it is the one actually in effect at the
  // instant it points to. An ambiguous wall clock has two valid candidates
  // and a skipped one has none, so only a lone valid `after` wins; every
  // other outcome falls back to the pre-transition offset.
  const afterIsValid = tzDiscover(localAsUtc - after * MS_PER_MINUTE, timezone).offset === after;
  const beforeIsValid = tzDiscover(localAsUtc - before * MS_PER_MINUTE, timezone).offset === before;

  if (afterIsValid && !beforeIsValid) return Math.round(after * 60);
  return Math.round(before * 60);
}

/**
 * Resolves the UTC offset and DST state of an instant in a timezone.
 * @param timestamp - The instant, in milliseconds since the Unix epoch.
 * @param timezone - The IANA timezone identifier.
 * @returns The offset in minutes (fractional when the zone has a sub-minute
 * offset, as several zones did before 1972) and whether DST is in effect.
 */
export function tzDiscover(timestamp: number, timezone: string): { offset: number, isDst: boolean; } {
  const formatterTZS = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'longOffset', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', });
  const formatterTZL = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'long', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', });
  const partsTZS = formatterTZS.formatToParts(timestamp);
  const partsTZL = formatterTZL.formatToParts(timestamp);
  const longName = getTimeFormatPart(partsTZL, 'timeZoneName').toLowerCase();
  const isDst = longName.includes('summer') || longName.includes('daylight');

  const _timezone = getTimeFormatPart(partsTZS, 'timeZoneName');
  if (_timezone === 'UTC' || _timezone === 'GMT') return { isDst: false, offset: 0 };

  // The seconds group covers pre-1972 LMT offsets such as GMT-00:44:30
  // (Africa/Monrovia), which Intl still reports verbatim.
  const match = _timezone.match(/^(?:GMT|UTC)?([+-])(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?$/i);
  if (!match) { throw new Error(`Unexpected timeZoneName format: ${_timezone}`); }
  const sign = match[1] === '+' ? 1 : -1;
  const hours = parseInt(match[2], 10);
  const mins = match[3] ? parseInt(match[3], 10) : 0;
  const secs = match[4] ? parseInt(match[4], 10) : 0;
  return { isDst, offset: sign * (hours * 60 + mins + secs / 60) };
}

function getTimeFormatPart(parts: Intl.DateTimeFormatPart[], type: string) {
  const part = parts.find(p => p.type === type);
  if (!part) {
    throw new Error(`Missing part ${type}`);
  }
  return part.value;
};
