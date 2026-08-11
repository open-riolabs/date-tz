import { TzInfo, TzProvider } from "./interfaces";

const MS_PER_DAY = 86400000;

/**
 * Reads the raw UTC offset of an instant straight from `Intl`, bypassing any
 * installed provider. Override providers need this to probe what the runtime
 * itself believes, without recursing back into themselves.
 *
 * @param timestamp - The instant, in milliseconds since the Unix epoch.
 * @param timezone - The IANA timezone identifier.
 * @returns The offset east of UTC, in (possibly fractional) minutes.
 */
export function intlOffsetMinutes(timestamp: number, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, timeZoneName: 'longOffset', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(timestamp);

  const name = parts.find(p => p.type === 'timeZoneName');
  if (!name) throw new Error('Missing part timeZoneName');
  if (name.value === 'UTC' || name.value === 'GMT') return 0;

  // The seconds group covers pre-1972 LMT offsets such as GMT-00:44:30
  // (Africa/Monrovia), which Intl still reports verbatim.
  const match = name.value.match(/^(?:GMT|UTC)?([+-])(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?$/i);
  if (!match) throw new Error(`Unexpected timeZoneName format: ${name.value}`);

  const sign = match[1] === '+' ? 1 : -1;
  const hours = parseInt(match[2], 10);
  const mins = match[3] ? parseInt(match[3], 10) : 0;
  const secs = match[4] ? parseInt(match[4], 10) : 0;
  return sign * (hours * 60 + mins + secs / 60);
}

/**
 * A zone's shortest DST-like period is Morocco's Ramadan pause, at 29 days.
 * Sampling every 10 days cannot step over a window that long, so the yearly
 * scan below always sees both sides of a zone's clock.
 */
const SAMPLE_STEP_MS = 10 * MS_PER_DAY;

/** Standard offset per zone and year; the yearly scan is worth paying once. */
const standardOffsetCache = new Map<string, number>();

/**
 * The zone's standard offset for a calendar year, taken as the smallest
 * offset it observes. Zones move their clocks *forward* to observe DST, so
 * the low-water mark over a full year is the offset they fall back to.
 *
 * The year is the unit because a zone's standard offset is only stable within
 * one: a country that permanently re-bases its offset mid-year has two, and
 * this deliberately reports the lower of them until the next January.
 *
 * @param timezone - The IANA timezone identifier.
 * @param year - The UTC calendar year to scan.
 * @returns The standard offset east of UTC, in minutes.
 */
function standardOffsetMinutes(timezone: string, year: number): number {
  const key = `${timezone}-${year}`;
  const cached = standardOffsetCache.get(key);
  if (cached !== undefined) return cached;

  let lowest = Infinity;
  const end = Date.UTC(year + 1, 0, 1);
  for (let t = Date.UTC(year, 0, 1); t < end; t += SAMPLE_STEP_MS) {
    const offset = intlOffsetMinutes(t, timezone);
    if (offset < lowest) lowest = offset;
  }

  standardOffsetCache.set(key, lowest);
  return lowest;
}

/**
 * The default provider, backed by the runtime's own timezone database.
 *
 * DST is derived by comparing the instant's offset against the zone's
 * standard offset, not by reading the zone's display name. Name matching
 * looks tempting — most zones render as "... Summer Time" — but it silently
 * fails wherever the runtime has no localized name and falls back to a bare
 * "GMT+01:00", which is exactly what happens for Africa/Casablanca,
 * Africa/El_Aaiun, Antarctica/Troll and the Channel Islands. It is also
 * locale-dependent, so the answer would change with the display language.
 *
 * The comparison fixes a semantic corner too. Europe/Dublin models its
 * winter as *negative* DST off a standard of UTC+1, so tzdata would call
 * January the DST period. `isDst` here answers the question users actually
 * ask — is this clock ahead of the zone's winter offset — and so reports
 * summer, not January.
 */
export const intlTzProvider: TzProvider = {
  offsetAt(timestamp: number, timezone: string): TzInfo {
    if (timezone === 'UTC' || timezone === 'Etc/UTC') return { offset: 0, isDst: false };

    const offset = intlOffsetMinutes(timestamp, timezone);
    const year = new Date(timestamp).getUTCFullYear();
    return { offset, isDst: offset > standardOffsetMinutes(timezone, year) };
  },
};

let activeProvider: TzProvider = intlTzProvider;

/**
 * Installs the provider every offset lookup goes through. Instances already
 * constructed keep the offset they resolved with, so install before creating
 * dates rather than after.
 *
 * @param provider - The provider to install, or null to restore the default.
 */
export function setTzProvider(provider: TzProvider | null): void {
  activeProvider = provider ?? intlTzProvider;
}

/** The provider currently resolving offsets. */
export function getTzProvider(): TzProvider {
  return activeProvider;
}
