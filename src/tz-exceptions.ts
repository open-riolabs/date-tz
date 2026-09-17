import { canonicalLink, etc } from "./canonical-link";

/**
 * A fixed UTC offset that a zone observes over a span of time, registered
 * with {@link TzExceptions} to take precedence over the runtime's timezone
 * data.
 */
export interface TzException {
  /**
   * The IANA timezone identifier. Aliases resolve on registration the same
   * way `DateTz` resolves them, so an exception registered for
   * `Canada/Pacific` covers dates created in `America/Vancouver`.
   */
  timezone: string;
  /**
   * The first instant covered, in milliseconds since the Unix epoch. The
   * bound is inclusive; leave it out for an exception with no start.
   */
  from?: number;
  /**
   * The first instant no longer covered, in milliseconds since the Unix
   * epoch. The bound is exclusive, so consecutive exceptions can share it;
   * leave it out for an exception with no end.
   */
  to?: number;
  /**
   * The offset east of UTC in minutes, signed: `-420` for UTC-7, `60` for
   * UTC+1. It replaces the runtime's offset outright rather than adjusting
   * it, so the result does not depend on how stale the runtime is.
   */
  offset: number;
  /** Whether the offset counts as summer time (DST) or as standard time. */
  isDst: boolean;
  /** What the exception is for, printed by {@link TzExceptions.toString}. */
  description?: string;
}

/**
 * Rule changes that runtimes in the field may not carry yet. Each `from` is
 * the UTC instant the change takes effect, stated in UTC because the local
 * wall clock at a transition is ambiguous by nature.
 */
const PRELOADED: readonly TzException[] = [
  {
    // 02:00 local on the UTC+1 the clock ran until then: clocks go back to
    // 01:00 and stay on UTC+0.
    timezone: 'Africa/Casablanca',
    from: Date.UTC(2026, 8, 20, 1, 0, 0),
    offset: 0,
    isDst: false,
    description: 'Morocco abolishes DST: permanent UTC+0 (tzdata 2026c)',
  },
  {
    timezone: 'Africa/El_Aaiun',
    from: Date.UTC(2026, 8, 20, 1, 0, 0),
    offset: 0,
    isDst: false,
    description: 'Western Sahara follows Moroccan clocks: permanent UTC+0 (tzdata 2026c)',
  },
  {
    // 02:00 local, when clocks would have fallen back to UTC-8. They stay on
    // UTC-7 instead, which tzdata now models as standard time (MST).
    timezone: 'America/Vancouver',
    from: Date.UTC(2026, 10, 1, 9, 0, 0),
    offset: -420,
    isDst: false,
    description: 'British Columbia stops changing clocks: permanent UTC-7 (tzdata 2026b)',
  },
];

const MINUTES_PER_DAY = 1440;

/** The widest instant a `Date` can represent, either side of the epoch. */
const MAX_TIME_VALUE = 8.64e15;

let listedZones: Set<string> | undefined;
let linkForward: Map<string, string>;
let linkReverse: Map<string, string>;

/**
 * Resolves a timezone identifier to the one `DateTz` carries for it, so an
 * exception registered under an alias still matches the dates it is meant
 * for. The two disagree more often than it seems: a runtime may list
 * `Asia/Calcutta` but not `Asia/Kolkata`, and `DateTz` then reports the
 * former for both.
 *
 * This mirrors `DateTz`'s own resolution step for step. Calling into
 * `DateTz` instead would close an import cycle — dates depend on the
 * provider, which depends on this registry — so a test holds the two to the
 * same answer for every identifier the library knows.
 *
 * @param timezone - The identifier to resolve.
 * @throws Error if the timezone is invalid.
 */
function resolveTimezone(timezone: string): string {
  if (typeof timezone !== 'string' || !timezone) throw new Error(`Invalid timezone: ${timezone}`);
  if (timezone === 'UTC') return 'Etc/UTC';

  if (!listedZones) {
    listedZones = new Set([...etc, ...Intl.supportedValuesOf('timeZone')]);
    linkForward = new Map(Object.entries(canonicalLink));
    linkReverse = new Map();
    for (const [alias, canonical] of linkForward) {
      if (!linkReverse.has(canonical)) linkReverse.set(canonical, alias);
    }
  }

  if (listedZones.has(timezone)) return timezone;

  const linked = linkForward.get(timezone);
  if (linked && listedZones.has(linked)) return linked;

  const alias = linkReverse.get(timezone);
  if (alias && listedZones.has(alias)) return alias;

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
  } catch {
    throw new Error(`Invalid timezone: ${timezone}`);
  }
  return timezone;
}

function isTimeValue(value: number): boolean {
  return Number.isFinite(value) && Math.abs(value) <= MAX_TIME_VALUE;
}

function start(exception: TzException): number {
  return exception.from ?? -Infinity;
}

function end(exception: TzException): number {
  return exception.to ?? Infinity;
}

function formatInstant(timestamp: number): string {
  return new Date(timestamp).toISOString().replace('.000Z', 'Z');
}

/** The covered span in interval notation: `[from, to)`, open ends as infinities. */
function formatRange(exception: TzException): string {
  const lower = exception.from === undefined ? '(-inf' : `[${formatInstant(exception.from)}`;
  const upper = exception.to === undefined ? '+inf)' : `${formatInstant(exception.to)})`;
  return `${lower}, ${upper}`;
}

/** `UTC+05:45`, with seconds only for the sub-minute offsets of old zones. */
function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+';
  const totalSeconds = Math.round(Math.abs(minutes) * 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return `UTC${sign}${pad(hours)}:${pad(mins)}${secs ? `:${pad(secs)}` : ''}`;
}

/**
 * The registry of timezone exceptions: rule changes the runtime's timezone
 * database may not carry yet.
 *
 * Offsets come from the runtime, and a runtime learns about a rule change
 * only when its copy of the IANA database is rebuilt — for a Node release or
 * an operating system image, that can be months after the change takes
 * effect. An exception states the new rule directly. The default provider
 * consults the registry before the runtime, so every date — constructed,
 * parsed or moved by arithmetic — follows a registered exception without any
 * other call. Morocco's and British Columbia's 2026 changes come preloaded.
 *
 * The registry is static, one per process, so it can be configured wherever
 * the application starts up. Register exceptions before creating dates: an
 * instance resolves its offset when its instant or zone changes, and does not
 * revisit it otherwise.
 */
export class TzExceptions {

  /** Registered exceptions per resolved zone, each list sorted by start. */
  static #exceptions = new Map<string, TzException[]>();

  /** Static only: there is a single registry, and nothing to instantiate. */
  private constructor() { }

  /**
   * Registers an exception.
   *
   * Exceptions for the same zone may not overlap: with at most one covering
   * any instant, what the registry answers never depends on the order things
   * were registered in. To replace an exception, preloaded ones included,
   * unregister its zone first. Registering an exception identical to one
   * already in place, description aside, changes nothing, so start-up code is
   * safe to run twice.
   *
   * @param exception - The exception to register.
   * @returns True when registered, false when an identical exception was
   * already in place.
   * @throws Error if a field is invalid, or if the exception overlaps another
   * one registered for the same zone.
   */
  static register(exception: TzException): boolean {
    const { from, to, offset, isDst, description } = exception;
    const timezone = resolveTimezone(exception.timezone);

    if (from !== undefined && !isTimeValue(from)) throw new Error(`Invalid from: ${from}`);
    if (to !== undefined && !isTimeValue(to)) throw new Error(`Invalid to: ${to}`);
    if (from !== undefined && to !== undefined && from >= to) {
      throw new Error(`Invalid range: from ${formatInstant(from)} is not before to ${formatInstant(to)}`);
    }
    // The unit is the likeliest mistake: -7 reads as UTC-7 but means seven
    // minutes. Nothing can reject that, but a value past a whole day cannot
    // be an offset at all.
    if (!Number.isFinite(offset) || Math.abs(offset) >= MINUTES_PER_DAY) {
      throw new Error(`Invalid offset: ${offset} (minutes east of UTC, less than a day either way)`);
    }
    if (typeof isDst !== 'boolean') throw new Error(`Invalid isDst: ${isDst}`);
    if (description !== undefined && typeof description !== 'string') throw new Error(`Invalid description: ${description}`);

    const entry: TzException = { timezone, offset, isDst };
    if (from !== undefined) entry.from = from;
    if (to !== undefined) entry.to = to;
    if (description !== undefined) entry.description = description;
    Object.freeze(entry);

    const registered = TzExceptions.#exceptions.get(timezone) ?? [];
    for (const other of registered) {
      if (start(entry) >= end(other) || start(other) >= end(entry)) continue;

      if (entry.from === other.from && entry.to === other.to && entry.offset === other.offset && entry.isDst === other.isDst) {
        return false;
      }
      throw new Error(`Exception for ${timezone} ${formatRange(entry)} overlaps the one registered for ${formatRange(other)}: unregister the zone first`);
    }

    TzExceptions.#exceptions.set(timezone, [...registered, entry].sort((a, b) => start(a) - start(b)));
    return true;
  }

  /**
   * Removes every exception registered for a zone, preloaded ones included,
   * handing its dates back to the runtime.
   *
   * @param timezone - The IANA timezone identifier. Aliases resolve as in
   * {@link register}.
   * @returns True when the zone had exceptions to remove.
   * @throws Error if the timezone is invalid.
   */
  static unregister(timezone: string): boolean {
    return TzExceptions.#exceptions.delete(resolveTimezone(timezone));
  }

  /** Removes every exception, preloaded ones included. */
  static clear(): void {
    TzExceptions.#exceptions.clear();
  }

  /** Restores the preloaded exceptions, dropping everything else. */
  static reset(): void {
    TzExceptions.clear();
    for (const exception of PRELOADED) TzExceptions.register(exception);
  }

  /**
   * The exception covering an instant in a zone, if there is one.
   *
   * Every offset lookup runs through here, so the zone is matched as given
   * rather than resolved again: pass the identifier a `DateTz` reports, which
   * is also what a provider receives.
   *
   * @param timestamp - The instant, in milliseconds since the Unix epoch.
   * @param timezone - The timezone identifier, as `DateTz` reports it.
   * @returns The covering exception, or undefined when the runtime decides.
   */
  static find(timestamp: number, timezone: string): TzException | undefined {
    return TzExceptions.#exceptions.get(timezone)
      ?.find(exception => start(exception) <= timestamp && timestamp < end(exception));
  }

  /**
   * Every registered exception, sorted by zone and then by start. Entries are
   * frozen: the registry only changes through {@link register},
   * {@link unregister}, {@link clear} and {@link reset}.
   */
  static list(): TzException[] {
    return [...TzExceptions.#exceptions.keys()].sort().flatMap(zone => TzExceptions.#exceptions.get(zone));
  }

  /**
   * Describes every registered exception, one per line, for debugging:
   *
   * ```text
   * TzExceptions: 1 exception registered
   *   America/Vancouver  [2026-11-01T09:00:00Z, +inf)  UTC-07:00  standard  British Columbia stops ...
   * ```
   *
   * Ranges read as intervals — `[` includes its bound, `)` excludes it — and
   * instants are in UTC.
   *
   * Being static, this overrides `Function.prototype.toString` on the class
   * itself, so `String(TzExceptions)` and template literals print the rules
   * rather than the class source.
   */
  static toString(): string {
    const exceptions = TzExceptions.list();
    if (exceptions.length === 0) return 'TzExceptions: no exceptions registered';

    const rows = exceptions.map(exception => [
      exception.timezone,
      formatRange(exception),
      formatOffset(exception.offset),
      exception.isDst ? 'DST' : 'standard',
      exception.description ?? '',
    ]);
    const widths = rows[0].map((_, column) => Math.max(...rows.map(row => row[column].length)));
    const lines = rows.map(row => `  ${row.map((cell, column) => cell.padEnd(widths[column])).join('  ')}`.trimEnd());

    const noun = exceptions.length === 1 ? 'exception' : 'exceptions';
    return [`TzExceptions: ${exceptions.length} ${noun} registered`, ...lines].join('\n');
  }
}

TzExceptions.reset();
