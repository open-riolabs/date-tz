import { DateTz } from '../src/date-tz';
import { installMoroccoOverride, MOROCCO_PERMANENT_UTC_FROM, runtimeKnowsMoroccoChange, withMoroccoOverride } from '../src/tz-overrides';
import { TzProvider } from '../src/interfaces';
import { getTzProvider, intlTzProvider, setTzProvider } from '../src/tz-provider';

/**
 * Morocco abolished daylight saving time on 2026-09-20 at 02:00 local,
 * settling on permanent UTC+0 and dropping the Ramadan pause that made it
 * the only zone in the world switching on a lunar schedule.
 *
 * These tests must hold both before and after the host's timezone database
 * learns that rule, so nothing here asserts on what the bare runtime returns
 * for a post-transition instant. The override supplies the rule; the probe
 * decides whether the runtime still needs it.
 */
describe('Morocco moves to permanent UTC+0', () => {
  afterEach(() => setTzProvider(null));

  const AFTER = Date.UTC(2026, 11, 22, 12, 23, 54);
  const BEFORE = Date.UTC(2026, 5, 22, 12, 23, 54);

  it('leaves instants before the transition on UTC+1', () => {
    installMoroccoOverride();
    const d = new DateTz(BEFORE, 'Africa/Casablanca');
    expect(d.timezoneOffset).toBe(3600000);
    expect(d.toString()).toBe('2026-06-22 13:23:54');
  });

  it('resolves instants after the transition to UTC+0', () => {
    installMoroccoOverride();
    const d = new DateTz(AFTER, 'Africa/Casablanca');
    expect(d.timezoneOffset).toBe(0);
    expect(d.toString()).toBe('2026-12-22 12:23:54');
  });

  it('applies to Western Sahara, which follows Moroccan clocks', () => {
    installMoroccoOverride();
    expect(new DateTz(AFTER, 'Africa/El_Aaiun').timezoneOffset).toBe(0);
    expect(new DateTz(BEFORE, 'Africa/El_Aaiun').timezoneOffset).toBe(3600000);
  });

  it('switches exactly at the transition instant, not a moment earlier', () => {
    installMoroccoOverride();
    expect(new DateTz(MOROCCO_PERMANENT_UTC_FROM - 1, 'Africa/Casablanca').timezoneOffset).toBe(3600000);
    expect(new DateTz(MOROCCO_PERMANENT_UTC_FROM, 'Africa/Casablanca').timezoneOffset).toBe(0);
  });

  it('reports no DST once the clock stops moving', () => {
    installMoroccoOverride();
    expect(new DateTz(AFTER, 'Africa/Casablanca').isDst).toBe(false);
    expect(new DateTz(AFTER, 'Africa/El_Aaiun').isDst).toBe(false);
  });

  // Clocks go back at the transition, so 01:00–02:00 local happens twice:
  // once on UTC+1 and again on UTC+0. Parsing takes the first occurrence.
  it('resolves the ambiguous wall clock to its first occurrence', () => {
    installMoroccoOverride();
    const d = DateTz.parse('2026-09-20 01:30:00', 'YYYY-MM-DD HH:mm:ss', 'Africa/Casablanca');
    expect(d.timestamp).toBe(Date.UTC(2026, 8, 20, 0, 30, 0));
    expect(d.timezoneOffset).toBe(3600000);
  });

  it('parses a post-transition wall clock against the new offset', () => {
    installMoroccoOverride();
    const d = DateTz.parse('2026-12-22 12:23:54', 'YYYY-MM-DD HH:mm:ss', 'Africa/Casablanca');
    expect(d.timestamp).toBe(AFTER);
  });

  it('leaves other zones untouched', () => {
    installMoroccoOverride();
    expect(new DateTz(AFTER, 'Europe/Rome').timezoneOffset).toBe(3600000);
    expect(new DateTz(AFTER, 'Etc/UTC').timezoneOffset).toBe(0);
  });
});

describe('the Morocco override cancels itself when it is not needed', () => {
  afterEach(() => setTzProvider(null));

  it('installs only while the runtime is behind on the rule', () => {
    const installed = installMoroccoOverride();
    // Whichever side of the tzdata update this runs on, the two must agree.
    expect(installed).toBe(!runtimeKnowsMoroccoChange());
  });

  it('is idempotent: wrapping an installed override changes nothing', () => {
    installMoroccoOverride();
    const active = getTzProvider();
    expect(installMoroccoOverride()).toBe(false);
    expect(getTzProvider()).toBe(active);
    expect(withMoroccoOverride(active)).toBe(active);
  });

  it('agrees with the runtime once the runtime knows the rule', () => {
    // A runtime carrying the new rule needs no correction, so an override
    // built on top of it must be the very same provider.
    if (!runtimeKnowsMoroccoChange()) return;
    expect(withMoroccoOverride(intlTzProvider)).toBe(intlTzProvider);
  });
});

/**
 * `Intl` renders some zones with a bare "GMT+01:00" instead of a name, so
 * deriving DST from the display name silently reports false for every one of
 * them. These are the zones where that used to happen.
 */
describe('isDst holds for zones the runtime does not name', () => {
  afterEach(() => setTzProvider(null));

  const shifted = Date.UTC(2026, 6, 15, 12, 0, 0);
  const standard = Date.UTC(2026, 0, 15, 12, 0, 0);

  it.each([
    ['Africa/El_Aaiun', Date.UTC(2026, 5, 1, 12, 0, 0), Date.UTC(2026, 1, 20, 12, 0, 0)],
    ['Antarctica/Troll', shifted, standard],
    ['Europe/Dublin', shifted, standard],
    ['Europe/Guernsey', shifted, standard],
    ['Europe/Isle_of_Man', shifted, standard],
    ['Europe/Jersey', shifted, standard],
  ])('%s reports DST only while its clock is shifted', (tz, on, off) => {
    expect(new DateTz(on, tz).isDst).toBe(true);
    expect(new DateTz(off, tz).isDst).toBe(false);
  });

  // Morocco's Ramadan pause is the inverse of an ordinary DST season: the
  // clock drops to UTC+0 for a month and returns to UTC+1 afterwards.
  it('Africa/Casablanca reports its Ramadan pause as standard time', () => {
    expect(new DateTz(Date.UTC(2026, 5, 1, 12, 0, 0), 'Africa/Casablanca').isDst).toBe(true);
    expect(new DateTz(Date.UTC(2026, 1, 20, 12, 0, 0), 'Africa/Casablanca').isDst).toBe(false);
  });

  it('still reports ordinary zones correctly', () => {
    expect(new DateTz(shifted, 'Europe/Rome').isDst).toBe(true);
    expect(new DateTz(standard, 'Europe/Rome').isDst).toBe(false);
    expect(new DateTz(shifted, 'America/New_York').isDst).toBe(true);
    expect(new DateTz(standard, 'America/New_York').isDst).toBe(false);
    // Southern hemisphere: the seasons, and so the flags, are reversed.
    expect(new DateTz(standard, 'Australia/Sydney').isDst).toBe(true);
    expect(new DateTz(shifted, 'Australia/Sydney').isDst).toBe(false);
    // A zone that has never observed DST never reports it.
    expect(new DateTz(shifted, 'Asia/Tokyo').isDst).toBe(false);
    expect(new DateTz(standard, 'Asia/Tokyo').isDst).toBe(false);
  });
});

describe('a custom provider replaces the runtime zone rules entirely', () => {
  afterEach(() => setTzProvider(null));

  /** Pins one zone to a fixed offset, deferring everything else. */
  const pinned = (zone: string, offset: number): TzProvider => ({
    offsetAt: (timestamp, timezone) => timezone === zone
      ? { offset, isDst: false }
      : intlTzProvider.offsetAt(timestamp, timezone),
  });

  const summer = Date.UTC(2026, 6, 15, 12, 0, 0);

  it('drives reads', () => {
    setTzProvider(pinned('Europe/Rome', 0));
    const d = new DateTz(summer, 'Europe/Rome');
    expect(d.timezoneOffset).toBe(0);
    expect(d.toString()).toBe('2026-07-15 12:00:00');
    expect(d.isDst).toBe(false);
  });

  it('drives parsing', () => {
    setTzProvider(pinned('Europe/Rome', 0));
    const d = DateTz.parse('2026-07-15 12:00:00', 'YYYY-MM-DD HH:mm:ss', 'Europe/Rome');
    expect(d.timestamp).toBe(summer);
  });

  it('leaves zones it does not claim to the runtime', () => {
    setTzProvider(pinned('Europe/Rome', 0));
    expect(new DateTz(summer, 'Asia/Tokyo').timezoneOffset).toBe(32400000);
  });

  it('restores the runtime rules when cleared', () => {
    setTzProvider(pinned('Europe/Rome', 0));
    setTzProvider(null);
    expect(getTzProvider()).toBe(intlTzProvider);
    expect(new DateTz(summer, 'Europe/Rome').timezoneOffset).toBe(7200000);
  });
});
