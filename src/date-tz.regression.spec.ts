import { DateTz } from './date-tz';

/** Independent reference: how Intl renders an instant in a zone. */
function intlRead(ts: number, tz: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false, year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).formatToParts(ts);
  const get = (t: string) => parts.find(p => p.type === t)!.value;
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')} ${hour}:${get('minute')}:${get('second')}`;
}

describe('offset and DST stay in sync with the instant', () => {
  it('re-resolves them after add() crosses a DST boundary', () => {
    const d = DateTz.parse('2025-01-15 12:00:00', 'YYYY-MM-DD HH:mm:ss', 'Europe/Rome');
    d.add(6, 'month');

    // arithmetic happens on the UTC timestamp, by design
    expect(new Date(d.timestamp).toISOString()).toBe('2025-07-15T11:00:00.000Z');
    // ...and the local read reflects the offset of the new instant
    expect(d.timezoneOffset).toBe(7200000);
    expect(d.isDst).toBe(true);
    expect(d.toString()).toBe('2025-07-15 13:00:00');
    expect(d.toString()).toBe(intlRead(d.timestamp, 'Europe/Rome'));
  });

  it('re-resolves them when leaving DST', () => {
    const d = DateTz.parse('2025-07-15 12:00:00', 'YYYY-MM-DD HH:mm:ss', 'Europe/Rome');
    d.add(6, 'month');
    expect(d.isDst).toBe(false);
    expect(d.timezoneOffset).toBe(3600000);
    expect(d.toString()).toBe(intlRead(d.timestamp, 'Europe/Rome'));
  });

  it('re-resolves them after set()', () => {
    const d = DateTz.parse('2025-01-15 12:00:00', 'YYYY-MM-DD HH:mm:ss', 'Europe/Rome');
    d.set(7, 'month');
    expect(d.isDst).toBe(true);
    expect(d.toString()).toBe(intlRead(d.timestamp, 'Europe/Rome'));
  });

  it('re-resolves them on direct assignment to timestamp and timezone', () => {
    const d = DateTz.parse('2025-01-15 12:00:00', 'YYYY-MM-DD HH:mm:ss', 'Europe/Rome');

    d.timestamp = Date.UTC(2025, 6, 15, 10, 0, 0);
    expect(d.isDst).toBe(true);
    expect(d.toString()).toBe(intlRead(d.timestamp, 'Europe/Rome'));

    d.timezone = 'Asia/Tokyo';
    expect(d.timestamp).toBe(Date.UTC(2025, 6, 15, 10, 0, 0));
    expect(d.toString()).toBe(intlRead(d.timestamp, 'Asia/Tokyo'));
  });

  it('keeps add() on a UTC wall clock, as designed', () => {
    const d = DateTz.parse('2025-06-15 08:00:00', 'YYYY-MM-DD HH:mm:ss', 'Europe/Rome');
    d.set(15, 'hour');
    expect(d.hourUTC).toBe(15);
    expect(d.toString()).toBe(intlRead(d.timestamp, 'Europe/Rome'));
  });
});

describe('sub-minute UTC offsets', () => {
  // Africa/Monrovia ran on GMT-00:44:30 until 1972-01-07.
  it('handles a zone whose offset carries seconds', () => {
    const ts = Date.UTC(1971, 5, 15, 12, 0, 0);
    const d = new DateTz(ts, 'Africa/Monrovia');
    expect(d.timezoneOffset).toBe(-2670000);
    expect(d.toString()).toBe(intlRead(ts, 'Africa/Monrovia'));
  });

  it('handles the same zone after the transition to UTC+0', () => {
    const d = new DateTz(Date.UTC(1972, 0, 8, 12, 0, 0), 'Africa/Monrovia');
    expect(d.timezoneOffset).toBe(0);
    expect(d.toString()).toBe('1972-01-08 12:00:00');
  });
});

describe('DateTz.parse with a 12-hour pattern', () => {
  it('parses a PM time with the AA marker', () => {
    const d = DateTz.parse('2025-06-15 03:30:00 PM', 'YYYY-MM-DD hh:mm:ss AA', 'Etc/UTC');
    expect(d.toString()).toBe('2025-06-15 15:30:00');
  });

  it('parses a pm time with the aa marker', () => {
    const d = DateTz.parse('2025-06-15 03:30:00 pm', 'YYYY-MM-DD hh:mm:ss aa', 'Etc/UTC');
    expect(d.toString()).toBe('2025-06-15 15:30:00');
  });

  it('parses an AM time', () => {
    const d = DateTz.parse('2025-06-15 03:30:00 AM', 'YYYY-MM-DD hh:mm:ss AA', 'Etc/UTC');
    expect(d.toString()).toBe('2025-06-15 03:30:00');
  });

  it('maps 12 AM to midnight and 12 PM to noon', () => {
    expect(DateTz.parse('2025-06-15 12:15:00 AM', 'YYYY-MM-DD hh:mm:ss AA', 'Etc/UTC').toString())
      .toBe('2025-06-15 00:15:00');
    expect(DateTz.parse('2025-06-15 12:15:00 PM', 'YYYY-MM-DD hh:mm:ss AA', 'Etc/UTC').toString())
      .toBe('2025-06-15 12:15:00');
  });

  it('round-trips through toString', () => {
    const d = new DateTz(Date.UTC(2025, 5, 15, 15, 30, 0), 'Etc/UTC');
    const formatted = d.toString('YYYY-MM-DD hh:mm:ss AA');
    expect(DateTz.parse(formatted, 'YYYY-MM-DD hh:mm:ss AA', 'Etc/UTC').timestamp).toBe(d.timestamp);
  });

  it('still rejects a 12-hour pattern with no marker', () => {
    expect(() => DateTz.parse('2025-06-15 03:30:00', 'YYYY-MM-DD hh:mm:ss', 'Etc/UTC'))
      .toThrow('AM/PM marker (aa or AA) is required when using 12-hour format (hh)');
  });
});

describe('add() with negative values', () => {
  const june = Date.UTC(2025, 5, 15, 12, 0, 0);
  const at = (ts: number) => new DateTz(ts, 'Etc/UTC');

  it('borrows across the year when subtracting months', () => {
    expect(at(june).add(-8, 'month').toString()).toBe('2024-10-15 12:00:00');
    expect(at(june).add(-6, 'month').toString()).toBe('2024-12-15 12:00:00');
    expect(at(june).add(-5, 'month').toString()).toBe('2025-01-15 12:00:00');
  });

  it('borrows across the month when subtracting days', () => {
    expect(at(june).add(-1, 'day').toString()).toBe('2025-06-14 12:00:00');
    expect(at(june).add(-30, 'day').toString()).toBe('2025-05-16 12:00:00');
  });

  it('borrows across the day for smaller units', () => {
    const midnight = Date.UTC(2025, 5, 15, 0, 0, 0);
    expect(at(june).add(-13, 'hour').toString()).toBe('2025-06-14 23:00:00');
    expect(at(midnight).add(-1, 'minute').toString()).toBe('2025-06-14 23:59:00');
    expect(at(midnight).add(-1, 'second').toString()).toBe('2025-06-14 23:59:59');
    expect(at(midnight).add(-1, 'millisecond').timestamp).toBe(midnight - 1);
  });

  it('subtracts years', () => {
    expect(at(june).add(-2, 'year').toString()).toBe('2023-06-15 12:00:00');
  });

  it('is symmetric with the matching addition', () => {
    expect(at(june).add(-8, 'month').add(8, 'month').timestamp).toBe(june);
    expect(at(june).add(-45, 'day').add(45, 'day').timestamp).toBe(june);
  });

  it('rejects a non-finite amount', () => {
    expect(() => at(june).add(NaN, 'day')).toThrow('Invalid value: NaN');
  });
});

describe('timezone identifiers are normalized everywhere', () => {
  it('resolves deprecated aliases in the constructor too', () => {
    const fromNow = DateTz.now('US/Eastern');
    const fromCtor = new DateTz(fromNow.timestamp, 'US/Eastern');
    expect(fromCtor.timezone).toBe('America/New_York');
    expect(fromCtor.timezone).toBe(fromNow.timezone);
    expect(fromNow.isComparable(fromCtor)).toBe(true);
  });

  it('maps UTC to Etc/UTC', () => {
    expect(new DateTz(0, 'UTC').timezone).toBe('Etc/UTC');
  });

  it('resolves Asia/Kashgar through its canonical link', () => {
    expect(new DateTz(Date.UTC(2025, 0, 1), 'Asia/Kashgar').timezone).toBe('Asia/Urumqi');
  });

  it('accepts every identifier reported by timezones()', () => {
    const rejected = DateTz.timezones().filter(tz => {
      try { new DateTz(Date.UTC(2025, 0, 1), tz); return false; } catch { return true; }
    });
    expect(rejected).toEqual([]);
  });

  it('rejects an unknown identifier', () => {
    expect(() => new DateTz(0, 'Foo/Bar')).toThrow('Invalid timezone: Foo/Bar');
    expect(() => DateTz.now('Foo/Bar')).toThrow('Invalid timezone: Foo/Bar');
  });
});

describe('supported range', () => {
  it('accepts the epoch itself', () => {
    expect(new DateTz(0, 'Etc/UTC').toString()).toBe('1970-01-01 00:00:00');
  });

  it('rejects instants before the epoch instead of producing garbage', () => {
    expect(() => new DateTz(-1, 'Etc/UTC')).toThrow(/before 1970-01-01/);
    expect(() => new DateTz(0, 'Etc/UTC').add(-1, 'day')).toThrow(/before 1970-01-01/);
    expect(() => new DateTz(Date.UTC(2025, 0, 1), 'Etc/UTC').set(1960, 'year')).toThrow(/before 1970-01-01/);
  });

  it('rejects a local wall clock that falls before the epoch', () => {
    expect(() => new DateTz(0, 'Etc/GMT+1').toString()).toThrow(/before 1970-01-01/);
  });

  it('rejects a non-finite timestamp', () => {
    expect(() => new DateTz(NaN, 'Etc/UTC')).toThrow('Invalid timestamp: NaN');
    expect(() => new DateTz(undefined as unknown as number, 'Etc/UTC')).toThrow('Invalid timestamp: undefined');
  });
});

describe('DST transitions resolve the same way in every zone', () => {
  const parse = (s: string, tz: string) => DateTz.parse(s, 'YYYY-MM-DD HH:mm:ss', tz);

  // A skipped wall clock takes the offset in effect before the transition,
  // which lands it past the gap. The direction must not depend on the sign
  // of the zone's offset.
  it('shifts a skipped time forward, east and west of UTC alike', () => {
    expect(parse('2025-03-30 02:30:00', 'Europe/Rome').toString()).toBe('2025-03-30 03:30:00');
    expect(parse('2025-03-09 02:30:00', 'America/New_York').toString()).toBe('2025-03-09 03:30:00');
    expect(parse('2025-10-05 02:30:00', 'Australia/Sydney').toString()).toBe('2025-10-05 03:30:00');
    expect(parse('2025-09-28 02:30:00', 'Pacific/Auckland').toString()).toBe('2025-09-28 03:30:00');
  });

  it('places a skipped time at the instant the pre-transition offset points to', () => {
    // 02:30 CET would be 01:30Z; the clock has already jumped to CEST there.
    expect(parse('2025-03-30 02:30:00', 'Europe/Rome').timestamp).toBe(Date.UTC(2025, 2, 30, 1, 30));
    // 02:30 EST would be 07:30Z; the clock has already jumped to EDT there.
    expect(parse('2025-03-09 02:30:00', 'America/New_York').timestamp).toBe(Date.UTC(2025, 2, 9, 7, 30));
  });

  it('resolves an ambiguous time to its first occurrence', () => {
    const rome = parse('2025-10-26 02:30:00', 'Europe/Rome');
    expect(rome.timestamp).toBe(Date.UTC(2025, 9, 26, 0, 30)); // 02:30 CEST, not CET
    expect(rome.isDst).toBe(true);
    expect(rome.toString()).toBe('2025-10-26 02:30:00');

    const ny = parse('2025-11-02 01:30:00', 'America/New_York');
    expect(ny.timestamp).toBe(Date.UTC(2025, 10, 2, 5, 30)); // 01:30 EDT, not EST
    expect(ny.isDst).toBe(true);
    expect(ny.toString()).toBe('2025-11-02 01:30:00');
  });

  it('handles a 30-minute transition', () => {
    const lordHowe = parse('2025-04-06 01:45:00', 'Australia/Lord_Howe');
    expect(lordHowe.timestamp).toBe(Date.UTC(2025, 3, 5, 14, 45));
    expect(lordHowe.toString()).toBe('2025-04-06 01:45:00');
  });

  it('round-trips unambiguous times either side of a transition', () => {
    const cases: Array<[string, string]> = [
      ['Europe/Rome', '2025-03-30 01:59:00'],
      ['Europe/Rome', '2025-03-30 03:00:00'],
      ['America/New_York', '2025-03-09 01:59:00'],
      ['America/New_York', '2025-03-09 03:00:00'],
      ['America/New_York', '2025-11-02 00:30:00'],
      ['America/New_York', '2025-11-02 02:30:00'],
      ['Pacific/Auckland', '2026-04-05 01:30:00'],
    ];
    for (const [tz, wall] of cases) {
      const parsed = parse(wall, tz);
      expect(parsed.toString()).toBe(wall);
      expect(intlRead(parsed.timestamp, tz)).toBe(wall);
    }
  });
});

describe('toString agrees with Intl across every supported zone', () => {
  it('renders the same wall clock as Intl.DateTimeFormat', () => {
    const samples = [
      Date.UTC(2025, 0, 15, 12, 0, 0),
      Date.UTC(2025, 6, 15, 12, 0, 0),
      Date.UTC(2025, 2, 30, 0, 30, 0),   // EU spring-forward
      Date.UTC(2025, 9, 26, 0, 30, 0),   // EU fall-back
      Date.UTC(2025, 2, 9, 7, 30, 0),    // US spring-forward
      Date.UTC(2025, 10, 2, 5, 30, 0),   // US fall-back
      Date.UTC(2024, 1, 29, 23, 30, 0),  // leap day
      Date.UTC(2025, 11, 31, 23, 59, 59),
    ];

    const mismatches: string[] = [];
    for (const tz of DateTz.supportedTimeZones()) {
      for (const ts of samples) {
        const actual = new DateTz(ts, tz).toString();
        const expected = intlRead(ts, tz);
        if (actual !== expected) mismatches.push(`${tz} @${ts}: ${actual} != ${expected}`);
      }
    }
    expect(mismatches).toEqual([]);
  });
});
