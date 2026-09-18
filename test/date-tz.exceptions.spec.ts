import { DateTz } from '../src/date-tz';
import { TzException, TzExceptions } from '../src/tz-exceptions';
import { MOROCCO_PERMANENT_UTC_FROM } from '../src/tz-overrides';
import { intlOffsetMinutes, intlTzProvider, setTzProvider } from '../src/tz-provider';

/**
 * Timezone exceptions carry rule changes the runtime's database may not know
 * about yet. Every assertion here must hold whether the host runs stale or
 * current tzdata, so nothing pins what the bare runtime returns after a
 * change: where the runtime's answer matters, it is read from `Intl` and
 * compared, never hard-coded.
 */

const MINUTE = 60000;
const HOUR = 60 * MINUTE;

/** 2026-09-20 02:00 local in Morocco, on the UTC+1 it ran until then. */
const MOROCCO_FROM = Date.UTC(2026, 8, 20, 1, 0, 0);
/** 2026-11-01 02:00 local in British Columbia, when clocks used to fall back. */
const VANCOUVER_FROM = Date.UTC(2026, 10, 1, 9, 0, 0);

const parse = (wallClock: string, tz: string) => DateTz.parse(wallClock, 'YYYY-MM-DD HH:mm:ss', tz);

/** The offset in minutes a date resolves, for comparison with raw Intl. */
const offsetMinutes = (timestamp: number, tz: string) => new DateTz(timestamp, tz).timezoneOffset / MINUTE;

afterEach(() => {
  TzExceptions.reset();
  setTzProvider(null);
});

describe('preloaded exceptions', () => {
  it('cover Morocco, Western Sahara and British Columbia', () => {
    expect(TzExceptions.list()).toEqual([
      { timezone: 'Africa/Casablanca', from: MOROCCO_FROM, offset: 0, isDst: false, description: expect.stringContaining('Morocco') },
      { timezone: 'Africa/El_Aaiun', from: MOROCCO_FROM, offset: 0, isDst: false, description: expect.stringContaining('Western Sahara') },
      { timezone: 'America/Vancouver', from: VANCOUVER_FROM, offset: -420, isDst: false, description: expect.stringContaining('British Columbia') },
    ]);
  });

  it('start Morocco at the same instant as the deprecated override', () => {
    expect(TzExceptions.find(MOROCCO_PERMANENT_UTC_FROM, 'Africa/Casablanca')).toBeDefined();
    expect(TzExceptions.find(MOROCCO_PERMANENT_UTC_FROM - 1, 'Africa/Casablanca')).toBeUndefined();
  });
});

describe('Morocco: permanent UTC+0 from 2026-09-20 02:00 local', () => {
  it('keeps UTC+1 up to the transition', () => {
    const d = new DateTz(MOROCCO_FROM - 1, 'Africa/Casablanca');
    expect(d.timezoneOffset).toBe(HOUR);
    expect(d.isDst).toBe(true);
    expect(d.toString()).toBe('2026-09-20 01:59:59');
  });

  it('moves to UTC+0 at the transition, turning the clock back to 01:00', () => {
    const d = new DateTz(MOROCCO_FROM, 'Africa/Casablanca');
    expect(d.timezoneOffset).toBe(0);
    expect(d.isDst).toBe(false);
    expect(d.toString()).toBe('2026-09-20 01:00:00');
  });

  // The old rules dropped to UTC+0 for Ramadan and returned to UTC+1 after
  // it; neither move happens any more.
  it.each([
    ['during what used to be the Ramadan pause', Date.UTC(2027, 1, 10, 12, 0, 0)],
    ['in what used to be UTC+1 after it', Date.UTC(2027, 6, 1, 12, 0, 0)],
    ['years later', Date.UTC(2030, 0, 15, 12, 0, 0)],
  ])('stays on UTC+0 %s', (_, timestamp) => {
    const d = new DateTz(timestamp, 'Africa/Casablanca');
    expect(d.timezoneOffset).toBe(0);
    expect(d.isDst).toBe(false);
  });

  it('applies to Western Sahara, which follows Moroccan clocks', () => {
    expect(new DateTz(MOROCCO_FROM - 1, 'Africa/El_Aaiun').timezoneOffset).toBe(HOUR);
    expect(new DateTz(MOROCCO_FROM, 'Africa/El_Aaiun').timezoneOffset).toBe(0);
    expect(new DateTz(Date.UTC(2027, 6, 1, 12, 0, 0), 'Africa/El_Aaiun').isDst).toBe(false);
  });

  // 01:00–02:00 local happens twice: first on UTC+1, then again on UTC+0.
  it('resolves the repeated hour to its first occurrence', () => {
    const d = parse('2026-09-20 01:30:00', 'Africa/Casablanca');
    expect(d.timestamp).toBe(Date.UTC(2026, 8, 20, 0, 30, 0));
    expect(d.timezoneOffset).toBe(HOUR);
  });

  it('reads a wall clock after the repeated hour on UTC+0', () => {
    expect(parse('2026-09-20 02:30:00', 'Africa/Casablanca').timestamp).toBe(Date.UTC(2026, 8, 20, 2, 30, 0));
  });

  it('makes the transition day 25 hours long for calendar arithmetic', () => {
    const d = parse('2026-09-19 12:00:00', 'Africa/Casablanca');
    const before = d.timestamp;
    d.add(1, 'day');
    expect(d.toString()).toBe('2026-09-20 12:00:00');
    expect(d.timestamp - before).toBe(25 * HOUR);
  });
});

describe('British Columbia: permanent UTC-7 from 2026-11-01 02:00 local', () => {
  it('keeps daylight time up to the transition', () => {
    const d = new DateTz(VANCOUVER_FROM - 1, 'America/Vancouver');
    expect(d.timezoneOffset).toBe(-7 * HOUR);
    expect(d.isDst).toBe(true);
    expect(d.toString()).toBe('2026-11-01 01:59:59');
  });

  it('does not fall back: the clock reads 02:00 and UTC-7 becomes standard time', () => {
    const d = new DateTz(VANCOUVER_FROM, 'America/Vancouver');
    expect(d.timezoneOffset).toBe(-7 * HOUR);
    expect(d.isDst).toBe(false);
    expect(d.toString()).toBe('2026-11-01 02:00:00');
  });

  it.each([
    ['the first winter', Date.UTC(2026, 11, 15, 12, 0, 0)],
    ['after the spring-forward that no longer happens', Date.UTC(2027, 2, 14, 10, 30, 0)],
    ['in the following summer', Date.UTC(2027, 6, 1, 12, 0, 0)],
    ['after the next fall-back that no longer happens', Date.UTC(2027, 10, 7, 9, 30, 0)],
    ['years later', Date.UTC(2030, 0, 15, 12, 0, 0)],
  ])('stays on UTC-7 standard time in %s', (_, timestamp) => {
    const d = new DateTz(timestamp, 'America/Vancouver');
    expect(d.timezoneOffset).toBe(-7 * HOUR);
    expect(d.isDst).toBe(false);
  });

  it('reads 02:30 on the transition day once, on UTC-7', () => {
    expect(parse('2026-11-01 02:30:00', 'America/Vancouver').timestamp).toBe(Date.UTC(2026, 10, 1, 9, 30, 0));
  });

  it('no longer skips an hour in spring', () => {
    const d = parse('2027-03-14 02:30:00', 'America/Vancouver');
    expect(d.timestamp).toBe(Date.UTC(2027, 2, 14, 9, 30, 0));
    expect(d.toString()).toBe('2027-03-14 02:30:00');
  });

  it('keeps the transition day 24 hours long for calendar arithmetic', () => {
    const d = parse('2026-10-31 12:00:00', 'America/Vancouver');
    const before = d.timestamp;
    d.add(1, 'day');
    expect(d.toString()).toBe('2026-11-01 12:00:00');
    expect(d.timestamp - before).toBe(24 * HOUR);
  });

  it('applies to dates created through the Canada/Pacific alias', () => {
    const d = new DateTz(Date.UTC(2026, 11, 15, 12, 0, 0), 'Canada/Pacific');
    expect(d.timezone).toBe('America/Vancouver');
    expect(d.timezoneOffset).toBe(-7 * HOUR);
  });

  it('leaves the rest of the Pacific coast changing its clocks', () => {
    const winter = new DateTz(Date.UTC(2026, 11, 15, 12, 0, 0), 'America/Los_Angeles');
    expect(winter.timezoneOffset).toBe(-8 * HOUR);
    expect(winter.isDst).toBe(false);
    const summer = new DateTz(Date.UTC(2027, 6, 1, 12, 0, 0), 'America/Los_Angeles');
    expect(summer.timezoneOffset).toBe(-7 * HOUR);
    expect(summer.isDst).toBe(true);
  });
});

describe('TzExceptions.register', () => {
  it('applies a new exception to dates in its zone', () => {
    expect(TzExceptions.register({ timezone: 'Europe/Rome', from: Date.UTC(2027, 0, 1), offset: 120, isDst: true })).toBe(true);

    const d = new DateTz(Date.UTC(2027, 0, 15, 12, 0, 0), 'Europe/Rome');
    expect(d.timezoneOffset).toBe(2 * HOUR);
    expect(d.isDst).toBe(true);
    expect(d.toString()).toBe('2027-01-15 14:00:00');
    expect(parse('2027-01-15 14:00:00', 'Europe/Rome').timestamp).toBe(Date.UTC(2027, 0, 15, 12, 0, 0));
  });

  it('includes from and excludes to', () => {
    const from = Date.UTC(2027, 0, 1);
    const to = Date.UTC(2027, 1, 1);
    TzExceptions.register({ timezone: 'Asia/Tokyo', from, to, offset: 600, isDst: true });

    expect(new DateTz(from - 1, 'Asia/Tokyo').timezoneOffset).toBe(9 * HOUR);
    expect(new DateTz(from, 'Asia/Tokyo').timezoneOffset).toBe(10 * HOUR);
    expect(new DateTz(to - 1, 'Asia/Tokyo').timezoneOffset).toBe(10 * HOUR);
    expect(new DateTz(to, 'Asia/Tokyo').timezoneOffset).toBe(9 * HOUR);
  });

  it('leaves out from for an exception with no start', () => {
    const to = Date.UTC(2000, 0, 1);
    TzExceptions.register({ timezone: 'Asia/Tokyo', to, offset: 600, isDst: false });
    expect(new DateTz(0, 'Asia/Tokyo').timezoneOffset).toBe(10 * HOUR);
    expect(new DateTz(to, 'Asia/Tokyo').timezoneOffset).toBe(9 * HOUR);
  });

  it('leaves out both bounds for an exception that always applies', () => {
    TzExceptions.register({ timezone: 'Asia/Tokyo', offset: 600, isDst: false });
    expect(new DateTz(0, 'Asia/Tokyo').timezoneOffset).toBe(10 * HOUR);
    expect(new DateTz(Date.UTC(2100, 0, 1), 'Asia/Tokyo').timezoneOffset).toBe(10 * HOUR);
  });

  it.each([
    ['west of UTC, with minutes', 'America/St_Johns', -210, '2027-01-15 08:30:00'],
    ['east of UTC, with minutes', 'Asia/Kathmandu', 345, '2027-01-15 17:45:00'],
    ['with seconds, as pre-1972 offsets had', 'Africa/Monrovia', -44.5, '2027-01-15 11:15:30'],
  ])('takes a signed offset %s', (_, tz, offset, wallClock) => {
    TzExceptions.register({ timezone: tz, offset, isDst: false });
    const d = new DateTz(Date.UTC(2027, 0, 15, 12, 0, 0), tz);
    expect(d.timezoneOffset).toBe(offset * MINUTE);
    expect(d.toString()).toBe(wallClock);
  });

  it('takes the DST flag from the exception rather than deriving it', () => {
    // Same offset Tokyo always has, declared as summer time.
    TzExceptions.register({ timezone: 'Asia/Tokyo', offset: 540, isDst: true });
    const d = new DateTz(Date.UTC(2027, 0, 15, 12, 0, 0), 'Asia/Tokyo');
    expect(d.timezoneOffset).toBe(9 * HOUR);
    expect(d.isDst).toBe(true);
  });

  it('resolves an alias to the identifier dates carry', () => {
    TzExceptions.unregister('America/Vancouver');
    TzExceptions.register({ timezone: 'Canada/Pacific', from: VANCOUVER_FROM, offset: -360, isDst: false });

    expect(TzExceptions.list().map(e => e.timezone)).toContain('America/Vancouver');
    expect(new DateTz(VANCOUVER_FROM, 'America/Vancouver').timezoneOffset).toBe(-6 * HOUR);
  });

  it('resolves every identifier the library knows exactly as DateTz does', () => {
    const mismatches: string[] = [];
    for (const tz of [...DateTz.timezones(), 'UTC']) {
      TzExceptions.clear();
      TzExceptions.register({ timezone: tz, offset: 0, isDst: false });
      const registered = TzExceptions.list()[0].timezone;
      const reported = new DateTz(0, tz).timezone;
      if (registered !== reported) mismatches.push(`${tz}: registered as ${registered}, dates carry ${reported}`);
    }
    expect(mismatches).toEqual([]);
  });

  it('changes nothing when an identical exception is already in place', () => {
    const before = TzExceptions.list();
    // The description is a label, not part of the rule.
    expect(TzExceptions.register({ timezone: 'Africa/Casablanca', from: MOROCCO_FROM, offset: 0, isDst: false })).toBe(false);
    expect(TzExceptions.list()).toEqual(before);
  });

  it('rejects an exception overlapping another in the same zone', () => {
    const before = TzExceptions.list();
    expect(() => TzExceptions.register({ timezone: 'America/Vancouver', from: Date.UTC(2026, 2, 9, 10), offset: -420, isDst: false }))
      .toThrow('Exception for America/Vancouver [2026-03-09T10:00:00Z, +inf) overlaps the one registered for [2026-11-01T09:00:00Z, +inf): unregister the zone first');
    expect(TzExceptions.list()).toEqual(before);
  });

  it('accepts consecutive exceptions that share a bound', () => {
    const [a, b, c] = [Date.UTC(2027, 0, 1), Date.UTC(2027, 1, 1), Date.UTC(2027, 2, 1)];
    expect(TzExceptions.register({ timezone: 'Asia/Tokyo', from: b, to: c, offset: 660, isDst: true })).toBe(true);
    expect(TzExceptions.register({ timezone: 'Asia/Tokyo', from: a, to: b, offset: 600, isDst: true })).toBe(true);

    expect(new DateTz(b - 1, 'Asia/Tokyo').timezoneOffset).toBe(10 * HOUR);
    expect(new DateTz(b, 'Asia/Tokyo').timezoneOffset).toBe(11 * HOUR);
  });

  const valid: TzException = { timezone: 'Asia/Tokyo', from: Date.UTC(2027, 0, 1), to: Date.UTC(2027, 1, 1), offset: 600, isDst: false };

  it.each<[string, Partial<Record<keyof TzException, unknown>>, string | RegExp]>([
    ['an unknown timezone', { timezone: 'Foo/Bar' }, 'Invalid timezone: Foo/Bar'],
    ['an empty timezone', { timezone: '' }, 'Invalid timezone: '],
    ['a non-finite offset', { offset: NaN }, /^Invalid offset: NaN/],
    ['an offset of a whole day', { offset: 1440 }, /^Invalid offset: 1440/],
    ['an offset of a whole day west', { offset: -1440 }, /^Invalid offset: -1440/],
    ['a missing DST flag', { isDst: undefined }, 'Invalid isDst: undefined'],
    ['a description that is not text', { description: 42 }, 'Invalid description: 42'],
    ['a non-finite from', { from: NaN }, 'Invalid from: NaN'],
    ['an infinite to', { to: Infinity }, 'Invalid to: Infinity'],
    ['an empty range', { to: Date.UTC(2027, 0, 1) }, 'Invalid range: from 2027-01-01T00:00:00Z is not before to 2027-01-01T00:00:00Z'],
    ['an inverted range', { from: Date.UTC(2027, 2, 1) }, 'Invalid range: from 2027-03-01T00:00:00Z is not before to 2027-02-01T00:00:00Z'],
  ])('rejects %s', (_, change, message) => {
    const before = TzExceptions.list();
    expect(() => TzExceptions.register({ ...valid, ...change } as TzException)).toThrow(message);
    expect(TzExceptions.list()).toEqual(before);
  });
});

describe('TzExceptions.unregister, clear and reset', () => {
  const winter = Date.UTC(2026, 11, 15, 12, 0, 0);

  it('unregister hands a zone back to the runtime', () => {
    expect(TzExceptions.unregister('America/Vancouver')).toBe(true);
    expect(offsetMinutes(winter, 'America/Vancouver')).toBe(intlOffsetMinutes(winter, 'America/Vancouver'));
    expect(TzExceptions.unregister('America/Vancouver')).toBe(false);
    // The other preloaded exceptions stay.
    expect(TzExceptions.list().map(e => e.timezone)).toEqual(['Africa/Casablanca', 'Africa/El_Aaiun']);
  });

  it('unregister resolves aliases', () => {
    expect(TzExceptions.unregister('Canada/Pacific')).toBe(true);
    expect(TzExceptions.find(winter, 'America/Vancouver')).toBeUndefined();
  });

  it('unregister rejects an unknown timezone', () => {
    expect(() => TzExceptions.unregister('America/Vancuver')).toThrow('Invalid timezone: America/Vancuver');
  });

  it('clear removes every exception, preloaded ones included', () => {
    TzExceptions.register({ timezone: 'Asia/Tokyo', offset: 600, isDst: false });
    TzExceptions.clear();
    expect(TzExceptions.list()).toEqual([]);
    expect(offsetMinutes(winter, 'Africa/Casablanca')).toBe(intlOffsetMinutes(winter, 'Africa/Casablanca'));
  });

  it('reset restores the preloaded exceptions and drops everything else', () => {
    const preloaded = TzExceptions.list();
    TzExceptions.register({ timezone: 'Asia/Tokyo', offset: 600, isDst: false });
    TzExceptions.unregister('Africa/Casablanca');

    TzExceptions.reset();
    expect(TzExceptions.list()).toEqual(preloaded);
  });
});

describe('TzExceptions.find and list', () => {
  it('find returns the exception covering an instant, if any', () => {
    expect(TzExceptions.find(VANCOUVER_FROM, 'America/Vancouver')?.description).toContain('British Columbia');
    expect(TzExceptions.find(VANCOUVER_FROM - 1, 'America/Vancouver')).toBeUndefined();
    expect(TzExceptions.find(VANCOUVER_FROM, 'America/Los_Angeles')).toBeUndefined();
  });

  // find sits on the path of every offset lookup, which only ever sees
  // identifiers DateTz has already resolved.
  it('find matches the zone as DateTz reports it, without resolving aliases', () => {
    expect(TzExceptions.find(VANCOUVER_FROM, 'Canada/Pacific')).toBeUndefined();
  });

  it('list sorts by zone, then by start', () => {
    TzExceptions.clear();
    TzExceptions.register({ timezone: 'Asia/Tokyo', from: Date.UTC(2028, 0, 1), offset: 600, isDst: false });
    TzExceptions.register({ timezone: 'Africa/Casablanca', offset: 60, isDst: false });
    TzExceptions.register({ timezone: 'Asia/Tokyo', to: Date.UTC(2027, 0, 1), offset: 600, isDst: false });

    expect(TzExceptions.list().map(e => [e.timezone, e.from, e.to])).toEqual([
      ['Africa/Casablanca', undefined, undefined],
      ['Asia/Tokyo', undefined, Date.UTC(2027, 0, 1)],
      ['Asia/Tokyo', Date.UTC(2028, 0, 1), undefined],
    ]);
  });

  it('list hands out entries that cannot change the registry', () => {
    const listed = TzExceptions.list();
    expect(Object.isFrozen(listed[0])).toBe(true);
    expect(() => { (listed[0] as { offset: number }).offset = 60; }).toThrow(TypeError);

    listed.pop();
    expect(TzExceptions.list()).toHaveLength(3);
    expect(new DateTz(MOROCCO_FROM, 'Africa/Casablanca').timezoneOffset).toBe(0);
  });

  it('list keeps the registered object out of reach', () => {
    const exception: TzException = { timezone: 'Asia/Tokyo', offset: 600, isDst: false };
    TzExceptions.register(exception);
    exception.offset = 660;
    expect(new DateTz(0, 'Asia/Tokyo').timezoneOffset).toBe(10 * HOUR);
  });
});

describe('TzExceptions.toString', () => {
  it('prints every preloaded exception, one per line', () => {
    expect(TzExceptions.toString()).toBe([
      'TzExceptions: 3 exceptions registered',
      '  Africa/Casablanca  [2026-09-20T01:00:00Z, +inf)  UTC+00:00  standard  Morocco abolishes DST: permanent UTC+0 (tzdata 2026c)',
      '  Africa/El_Aaiun    [2026-09-20T01:00:00Z, +inf)  UTC+00:00  standard  Western Sahara follows Moroccan clocks: permanent UTC+0 (tzdata 2026c)',
      '  America/Vancouver  [2026-11-01T09:00:00Z, +inf)  UTC-07:00  standard  British Columbia stops changing clocks: permanent UTC-7 (tzdata 2026b)',
    ].join('\n'));
  });

  it('shows open and closed bounds, DST, sub-minute offsets and missing descriptions', () => {
    TzExceptions.clear();
    TzExceptions.register({ timezone: 'Africa/Monrovia', to: Date.UTC(1972, 0, 7), offset: -44.5, isDst: false });
    TzExceptions.register({ timezone: 'Asia/Tokyo', from: Date.UTC(2027, 0, 1, 0, 0, 0, 500), to: Date.UTC(2027, 1, 1), offset: 600, isDst: true, description: 'Trial' });
    TzExceptions.register({ timezone: 'Etc/GMT-14', offset: 840, isDst: false });

    // Columns pad to their widest cell: the Tokyo range (48 characters) and
    // the Monrovia offset (12). Trailing padding is trimmed.
    expect(TzExceptions.toString()).toBe([
      'TzExceptions: 3 exceptions registered',
      '  Africa/Monrovia  (-inf, 1972-01-07T00:00:00Z)' + ' '.repeat(22) + 'UTC-00:44:30  standard',
      '  Asia/Tokyo       [2027-01-01T00:00:00.500Z, 2027-02-01T00:00:00Z)  UTC+10:00     DST       Trial',
      '  Etc/GMT-14       (-inf, +inf)' + ' '.repeat(38) + 'UTC+14:00     standard',
    ].join('\n'));
  });

  it('uses the singular for one exception', () => {
    TzExceptions.clear();
    TzExceptions.register({ timezone: 'Asia/Tokyo', offset: 600, isDst: false, description: 'Trial' });
    expect(TzExceptions.toString()).toBe('TzExceptions: 1 exception registered\n  Asia/Tokyo  (-inf, +inf)  UTC+10:00  standard  Trial');
  });

  it('reports an empty registry', () => {
    TzExceptions.clear();
    expect(TzExceptions.toString()).toBe('TzExceptions: no exceptions registered');
  });

  it('is what the class turns into as a string', () => {
    expect(String(TzExceptions)).toBe(TzExceptions.toString());
    expect(`${TzExceptions}`).toBe(TzExceptions.toString());
  });
});

describe('exceptions and providers', () => {
  const winter = Date.UTC(2026, 11, 15, 12, 0, 0);

  it('the default provider answers with the exception', () => {
    expect(intlTzProvider.offsetAt(winter, 'America/Vancouver')).toEqual({ offset: -420, isDst: false });
  });

  it('a provider that delegates to the default one inherits them', () => {
    setTzProvider({
      offsetAt: (timestamp, timezone) => timezone === 'Europe/Rome'
        ? { offset: 0, isDst: false }
        : intlTzProvider.offsetAt(timestamp, timezone),
    });
    expect(new DateTz(winter, 'America/Vancouver').timezoneOffset).toBe(-7 * HOUR);
    expect(new DateTz(winter, 'Europe/Rome').timezoneOffset).toBe(0);
  });

  it('a provider that answers on its own replaces them too', () => {
    setTzProvider({ offsetAt: () => ({ offset: 60, isDst: false }) });
    expect(new DateTz(winter, 'America/Vancouver').timezoneOffset).toBe(HOUR);
  });
});

describe('dates created before a change to the registry', () => {
  it('keep their offset until their instant or zone changes', () => {
    const winter = Date.UTC(2026, 11, 15, 12, 0, 0);
    const d = new DateTz(winter, 'America/Vancouver');

    TzExceptions.unregister('America/Vancouver');
    expect(d.timezoneOffset).toBe(-7 * HOUR);

    d.setTimezone('America/Vancouver');
    expect(d.timezoneOffset / MINUTE).toBe(intlOffsetMinutes(winter, 'America/Vancouver'));
  });
});
