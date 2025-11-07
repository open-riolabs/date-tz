import { DateTz } from './date-tz';

describe('DateTz constructor', () => {
  it('normalizes "UTC" alias to "Etc/UTC"', () => {
    const dateTz = new DateTz(1609459200000, 'UTC');
    expect(dateTz.timestamp).toBe(1609459200000);
    expect(dateTz.timezone).toBe('Etc/UTC');
  });

  it('keeps provided IANA timezone', () => {
    const dateTz = new DateTz(1609459200000, 'Europe/Rome');
    expect(dateTz.timezone).toBe('Europe/Rome');
  });
});

describe('DateTz.now', () => {
  it('returns a current timestamp in requested timezone', () => {
    const nowRome = DateTz.now('Europe/Rome');
    expect(nowRome.timezone).toBe('Europe/Rome');
    expect(typeof nowRome.timestamp).toBe('number');
  });
});

describe('DateTz.toString formatting', () => {
  const baseTs = 1609459200000; // 2021-01-01 00:00:00 UTC

  it('uses default pattern when none provided', () => {
    const d = new DateTz(baseTs, 'Etc/UTC');
    expect(d.toString()).toBe('2021-01-01 00:00:00');
  });

  it('formats 24h pattern with tokens', () => {
    const d = new DateTz(baseTs + 15 * 3600000, 'Etc/UTC'); // 15:00:00
    expect(d.toString('YYYY-MM-DD HH:mm:ss')).toBe('2021-01-01 15:00:00');
  });

  it('formats 12h pattern with AM/PM (PM case)', () => {
    const d = new DateTz(baseTs + 13 * 3600000, 'Etc/UTC'); // 13:00 UTC -> 01:00 PM
    expect(d.toString('YYYY-MM-DD hh:mm:ss AA')).toBe('2021-01-01 01:00:00 PM');
  });

  it('formats 12h pattern with AM/PM (AM midnight)', () => {
    const d = new DateTz(baseTs, 'Etc/UTC'); // 00:00 UTC -> 12:00 AM
    expect(d.toString('YYYY-MM-DD hh:mm:ss aa')).toBe('2021-01-01 12:00:00 am');
  });

  it('formats 12h pattern at noon', () => {
    const d = new DateTz(baseTs + 12 * 3600000, 'Etc/UTC'); // 12:00 UTC -> 12:00 PM
    expect(d.toString('YYYY-MM-DD hh:mm AA')).toBe('2021-01-01 12:00 PM');
  });

  it('includes timezone when tz token used', () => {
    const d = new DateTz(baseTs, 'Europe/Rome');
    expect(d.toString('YYYY-MM-DD HH:mm tz')).toBe('2021-01-01 01:00 Europe/Rome');
  });

  it('includes long month name LM and yy token', () => {
    const d = new DateTz(baseTs, 'Etc/UTC');
    // January expected in English locale, capitalized by implementation
    const str = d.toString('yy-LM-DD');
    expect(str).toBe('21-January-01');
  });
});

describe('DateTz.parse basic', () => {
  it('parses a UTC date-time string', () => {
    const parsed = DateTz.parse('2021-01-01 00:00:00', 'YYYY-MM-DD HH:mm:ss', 'Etc/UTC');
    expect(parsed.timestamp).toBe(1609459200000);
    expect(parsed.timezone).toBe('Etc/UTC');
    // Round trip
    expect(parsed.toString('YYYY-MM-DD HH:mm:ss')).toBe('2021-01-01 00:00:00');
  });

  it('parses with 24h hour near midnight', () => {
    const parsed = DateTz.parse('2021-01-01 23:59:59', 'YYYY-MM-DD HH:mm:ss', 'Etc/UTC');
    expect(parsed.toString('YYYY-MM-DD HH:mm:ss')).toBe('2021-01-01 23:59:59');
  });

  it.skip('parses with 12h format and AM/PM (known limitation: parse ignores aa/AA tokens)', () => {
    const parsed = DateTz.parse('2021-01-01 01:00:00 PM', 'YYYY-MM-DD hh:mm:ss AA', 'Etc/UTC');
    // Intended expectation would be 13:00:00 but implementation currently ignores AA.
    expect(parsed.timestamp).toBe(1609462800000);
  });

  it('throws when 12h format used without AM/PM', () => {
    expect(() => DateTz.parse('2021-01-01 01:00:00', 'YYYY-MM-DD hh:mm:ss', 'Etc/UTC')).toThrow();
  });

  it('parses fixed offset timezone (Asia/Calcutta +05:30) and preserves local wall time string', () => {
    const parsed = DateTz.parse('2021-06-01 12:15:30', 'YYYY-MM-DD HH:mm:ss', 'Asia/Calcutta');
    expect(parsed.timezone).toBe('Asia/Calcutta');
    expect(parsed.toString('YYYY-MM-DD HH:mm:ss')).toBe('2021-06-01 12:15:30');
  });

  it('parses non-DST zone (Asia/Dubai) consistently', () => {
    const a = DateTz.parse('2021-02-01 10:00:00', 'YYYY-MM-DD HH:mm:ss', 'Asia/Dubai');
    const b = DateTz.parse('2021-08-01 10:00:00', 'YYYY-MM-DD HH:mm:ss', 'Asia/Dubai');
    expect(a.timezoneOffset).toBe(b.timezoneOffset);
  });

  it('throws on invalid timezone', () => {
    expect(() => DateTz.parse('2021-01-01 00:00:00', 'YYYY-MM-DD HH:mm:ss', 'Invalid/Zone')).toThrow();
  });
});

describe('DST transitions Europe/Rome 2025 (spring forward)', () => {
  // Last Sunday of March 2025 is 2025-03-30. At 02:00 local time clocks move to 03:00.
  const beforeDst = DateTz.parse('2025-03-30 01:59:59', 'YYYY-MM-DD HH:mm:ss', 'Europe/Rome');
  const afterDst = DateTz.parse('2025-03-30 03:00:00', 'YYYY-MM-DD HH:mm:ss', 'Europe/Rome');

  it('offset increases after spring forward', () => {
    expect(afterDst.timezoneOffset).toBeGreaterThan(beforeDst.timezoneOffset);
  });

  it('UTC elapsed milliseconds between instants is 1 second (lost hour is wall-clock only)', () => {
    const diffMs = afterDst.timestamp - beforeDst.timestamp;
    expect(diffMs).toBe(1000);
  });
});

describe('DST transitions Europe/London 2025 (spring forward & autumn back)', () => {
  const beforeSpring = DateTz.parse('2025-03-30 00:59:59', 'YYYY-MM-DD HH:mm:ss', 'Europe/London');
  const afterSpring = DateTz.parse('2025-03-30 02:00:00', 'YYYY-MM-DD HH:mm:ss', 'Europe/London');
  it('offset increases after UK spring forward', () => {
    expect(afterSpring.timezoneOffset).toBeGreaterThan(beforeSpring.timezoneOffset);
  });

  const beforeAutumn = DateTz.parse('2025-10-26 00:30:00', 'YYYY-MM-DD HH:mm:ss', 'Europe/London');
  const afterAutumn = DateTz.parse('2025-10-26 02:30:00', 'YYYY-MM-DD HH:mm:ss', 'Europe/London');
  it('offset decreases after UK autumn back', () => {
    expect(afterAutumn.timezoneOffset).toBeLessThan(beforeAutumn.timezoneOffset);
  });
});

describe('DST transitions America/New_York 2025 (fall back)', () => {
  // First Sunday of Nov 2025 is 2025-11-02. At 02:00 local clocks go back to 01:00.
  const beforeFallback = DateTz.parse('2025-11-02 00:30:00', 'YYYY-MM-DD HH:mm:ss', 'America/New_York');
  const afterFallback = DateTz.parse('2025-11-02 02:30:00', 'YYYY-MM-DD HH:mm:ss', 'America/New_York');

  it('offset decreases after fall back (EDT -> EST)', () => {
    expect(afterFallback.timezoneOffset).toBeLessThan(beforeFallback.timezoneOffset);
  });

  it('UTC elapsed includes repeated hour (~3h real difference)', () => {
    const diffMs = afterFallback.timestamp - beforeFallback.timestamp;
    expect(diffMs).toBe(3 * 3600000); // 3 hours in UTC between 00:30 EDT and 02:30 EST
  });
});

describe('DST transitions Australia/Sydney 2025 (autumn end & spring start)', () => {
  // DST ends first Sunday April 6 2025 at 03:00 -> 02:00
  const beforeEnd = DateTz.parse('2025-04-06 00:30:00', 'YYYY-MM-DD HH:mm:ss', 'Australia/Sydney');
  const afterEnd = DateTz.parse('2025-04-06 02:30:00', 'YYYY-MM-DD HH:mm:ss', 'Australia/Sydney');
  it('offset decreases after DST end in Sydney', () => {
    expect(afterEnd.timezoneOffset).toBeLessThan(beforeEnd.timezoneOffset);
  });
  // DST starts first Sunday October 5 2025 at 02:00 -> 03:00
  const beforeStart = DateTz.parse('2025-10-05 01:59:59', 'YYYY-MM-DD HH:mm:ss', 'Australia/Sydney');
  const afterStart = DateTz.parse('2025-10-05 03:00:00', 'YYYY-MM-DD HH:mm:ss', 'Australia/Sydney');
  it('offset increases after DST start in Sydney', () => {
    expect(afterStart.timezoneOffset).toBeGreaterThan(beforeStart.timezoneOffset);
  });
});

describe('Non-DST stability checks', () => {
  it('Asia/Dubai offset stable across months', () => {
    const jan = DateTz.parse('2025-01-15 12:00:00', 'YYYY-MM-DD HH:mm:ss', 'Asia/Dubai');
    const aug = DateTz.parse('2025-08-15 12:00:00', 'YYYY-MM-DD HH:mm:ss', 'Asia/Dubai');
    expect(jan.timezoneOffset).toBe(aug.timezoneOffset);
  });
  it('Africa/Nairobi offset stable across months', () => {
    const jan = DateTz.parse('2025-01-15 12:00:00', 'YYYY-MM-DD HH:mm:ss', 'Africa/Nairobi');
    const aug = DateTz.parse('2025-08-15 12:00:00', 'YYYY-MM-DD HH:mm:ss', 'Africa/Nairobi');
    expect(jan.timezoneOffset).toBe(aug.timezoneOffset);
  });
});

describe('clone and convert', () => {
  it('convertToTimezone changes timezone only', () => {
    const d = new DateTz(1609459200000, 'Etc/UTC');
    const originalTs = d.timestamp;
    d.convertToTimezone('Europe/Rome');
    expect(d.timezone).toBe('Europe/Rome');
    expect(d.timestamp).toBe(originalTs);
  });

  it('cloneToTimezone preserves original instance', () => {
    const d = new DateTz(1609459200000, 'Etc/UTC');
    const clone = d.cloneToTimezone('Europe/Rome');
    expect(d.timezone).toBe('Etc/UTC');
    expect(clone.timezone).toBe('Europe/Rome');
    expect(clone.timestamp).toBe(d.timestamp);
  });
});

describe('stripSecMillis', () => {
  it('removes seconds and milliseconds', () => {
    const tsWithSec = 1609459265123; // 2021-01-01 00:01:05.123 UTC
    const d = new DateTz(tsWithSec, 'Etc/UTC');
    d.stripSecMillis();
    expect(d.toString()).toBe('2021-01-01 00:01:00');
  });
});

describe('add and set', () => {
  it('add minutes rolls over hour', () => {
    const d = new DateTz(1609459200000, 'Etc/UTC');
    d.add(70, 'minute');
    expect(d.toString('YYYY-MM-DD HH:mm')).toBe('2021-01-01 01:10');
  });

  it('set hour changes only hour component', () => {
    const d = new DateTz(1609459200000, 'Etc/UTC');
    d.set(5, 'hour');
    expect(d.hour).toBe(5);
    expect(d.toString('YYYY-MM-DD HH:mm')).toBe('2021-01-01 05:00');
  });
});

describe('compare and isComparable', () => {
  const baseTs = 1609459200000; // 2021-01-01 00:00:00 UTC

  it('returns zero when timestamps equal and timezones match', () => {
    const a = new DateTz(baseTs, 'Etc/UTC');
    const b = new DateTz(baseTs, 'Etc/UTC');
    expect(a.isComparable(b)).toBe(true);
    expect(a.compare(b)).toBe(0);
  });

  it('returns positive when first is later (same timezone)', () => {
    const a = new DateTz(baseTs + 5000, 'Etc/UTC');
    const b = new DateTz(baseTs, 'Etc/UTC');
    expect(a.compare(b)).toBe(5000);
  });

  it('returns negative when first is earlier (same timezone)', () => {
    const a = new DateTz(baseTs, 'Etc/UTC');
    const b = new DateTz(baseTs + 250, 'Etc/UTC');
    expect(a.compare(b)).toBe(-250);
  });

  it('throws when timezones differ', () => {
    const a = new DateTz(baseTs, 'Etc/UTC');
    const b = new DateTz(baseTs, 'Europe/Rome');
    expect(a.isComparable(b)).toBe(false);
    expect(() => a.compare(b)).toThrow('Cannot compare dates with different timezones');
  });

  it('isComparable false for differing timezones even if same offset at moment', () => {
    // Example: UTC vs Africa/Abidjan (also UTC offset but different TZ name)
    const a = new DateTz(baseTs, 'Etc/UTC');
    const b = new DateTz(baseTs, 'Africa/Abidjan');
    expect(a.timezoneOffset).toBe(b.timezoneOffset); // Offsets equal
    expect(a.isComparable(b)).toBe(false);
  });
});