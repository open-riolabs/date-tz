import { DateTz } from '../src/date-tz';
import { IDateTz } from '../src/interfaces';

const TS = 1786621500000; // 2026-08-13 13:45:00 in Europe/Rome
const JAN = Date.UTC(2026, 0, 15, 12, 0, 0);
const MINUTE = 60000;
const HOUR = 60 * MINUTE;

/** What an instance at TS in Europe/Rome serialises to. */
const ROME = { timestamp: TS, timezone: 'Europe/Rome', timezoneOffset: 2 * HOUR, isDst: true };

/** A value as it comes out the other side of JSON. */
const wire = (value: unknown) => JSON.parse(JSON.stringify(value));

/**
 * Instances are stored and sent as they are — by `JSON.stringify`, by
 * database drivers, by `structuredClone` and object spread — so the four
 * public fields are the serialised form, and the constructor has to accept
 * it back.
 *
 * Hiding them broke that twice. As TypeScript `private` fields renamed
 * `_timestamp`/`_timezone`, rebuilding an instance read `undefined`. As
 * ECMAScript `#private` fields, every copy that does not call `toJSON` —
 * database drivers, `structuredClone`, object spread — got an empty object.
 */
describe('an instance serialises as its four public fields', () => {
  const d = new DateTz(TS, 'Europe/Rome');

  it('carries them as own enumerable properties, and nothing else', () => {
    expect(Object.keys(d)).toEqual(['timestamp', 'timezone', 'timezoneOffset', 'isDst']);
  });

  it('emits them through JSON.stringify, in declaration order', () => {
    expect(JSON.stringify(d)).toBe('{"timestamp":1786621500000,"timezone":"Europe/Rome","timezoneOffset":7200000,"isDst":true}');
  });

  it('keeps them in copies that do not go through JSON', () => {
    expect(structuredClone(d)).toEqual(ROME);
    expect({ ...d }).toEqual(ROME);
    expect(Object.assign({}, d)).toEqual(ROME);
  });

  it('exposes them to serialisers that walk the object by hand', () => {
    const walked: Record<string, unknown> = {};
    for (const key in d) walked[key] = d[key];
    expect(walked).toEqual(ROME);
    expect(Object.entries(d)).toEqual(Object.entries(ROME));
  });

  it('is told apart from another instant or zone by a deep equality check', () => {
    expect(new DateTz(TS + 1, 'Europe/Rome')).not.toEqual(d);
    // Same offset and DST state, different zone.
    expect(new DateTz(TS, 'Europe/Paris')).not.toEqual(d);
  });
});

describe('the serialised form carries the offset and DST of its zone', () => {
  it.each([
    ['Etc/UTC', 'August', TS, 0, false],
    ['Europe/Rome', 'August', TS, 2 * HOUR, true],
    ['Europe/Rome', 'January', JAN, HOUR, false],
    ['America/New_York', 'August', TS, -4 * HOUR, true],
    ['America/New_York', 'January', JAN, -5 * HOUR, false],
    ['Australia/Sydney', 'August', TS, 10 * HOUR, false],
    ['Australia/Sydney', 'January', JAN, 11 * HOUR, true],
    ['Asia/Kolkata', 'August', TS, 5 * HOUR + 30 * MINUTE, false],
    ['Asia/Kathmandu', 'August', TS, 5 * HOUR + 45 * MINUTE, false],
  ])('%s in %s', (timezone, _month, timestamp, timezoneOffset, isDst) => {
    const d = new DateTz(timestamp, timezone);
    // The identifier is the one the runtime supports: an ICU that still
    // lists the old names turns Asia/Kolkata into Asia/Calcutta.
    expect(wire(d)).toEqual({ timestamp, timezone: d.timezone, timezoneOffset, isDst });
  });
});

describe('the serialised form follows the instance through every change', () => {
  const rome = () => new DateTz(TS, 'Europe/Rome');

  it('add() with a calendar unit, out of DST', () => {
    // 2026-08-13 13:45 CEST -> 2026-11-13 13:45 CET
    expect(wire(rome().add(3, 'month'))).toEqual({
      timestamp: Date.UTC(2026, 10, 13, 12, 45, 0), timezone: 'Europe/Rome', timezoneOffset: HOUR, isDst: false,
    });
  });

  it('add() with a time unit, across the end of DST', () => {
    // 02:30 CEST -> 02:30 CET: the repeated wall clock, an hour later.
    const d = new DateTz(Date.UTC(2026, 9, 25, 0, 30, 0), 'Europe/Rome').add(1, 'hour');
    expect(wire(d)).toEqual({
      timestamp: Date.UTC(2026, 9, 25, 1, 30, 0), timezone: 'Europe/Rome', timezoneOffset: HOUR, isDst: false,
    });
  });

  it('set()', () => {
    // 2026-08-13 13:45 CEST -> 2026-01-13 13:45 CET
    expect(wire(rome().set(1, 'month'))).toEqual({
      timestamp: Date.UTC(2026, 0, 13, 12, 45, 0), timezone: 'Europe/Rome', timezoneOffset: HOUR, isDst: false,
    });
  });

  it('stripSecMillis()', () => {
    expect(wire(new DateTz(TS + 12345, 'Europe/Rome').stripSecMillis())).toEqual(ROME);
  });

  it('setTimezone(), keeping the instant', () => {
    expect(wire(rome().setTimezone('America/New_York'))).toEqual({
      timestamp: TS, timezone: 'America/New_York', timezoneOffset: -4 * HOUR, isDst: true,
    });
  });

  it('setTimezone() with an alias, carrying the resolved identifier', () => {
    expect(wire(rome().setTimezone('US/Eastern')).timezone).toBe('America/New_York');
  });

  it('cloneToTimezone(), leaving the original as it was', () => {
    const d = rome();
    expect(wire(d.cloneToTimezone('Asia/Tokyo'))).toEqual({
      timestamp: TS, timezone: 'Asia/Tokyo', timezoneOffset: 9 * HOUR, isDst: false,
    });
    expect(wire(d)).toEqual(ROME);
  });
});

describe('every way of building an instance serialises the same way', () => {
  it('parse()', () => {
    expect(wire(DateTz.parse('2026-08-13 13:45:00', 'YYYY-MM-DD HH:mm:ss', 'Europe/Rome'))).toEqual(ROME);
  });

  it('now()', () => {
    const before = Date.now();
    const serialised = wire(DateTz.now('Europe/Rome'));
    expect(Object.keys(serialised)).toEqual(['timestamp', 'timezone', 'timezoneOffset', 'isDst']);
    expect(serialised.timestamp).toBeGreaterThanOrEqual(before);
    expect(serialised.timezone).toBe('Europe/Rome');
  });

  it('the default zone', () => {
    expect(wire(new DateTz(TS))).toEqual({ timestamp: TS, timezone: 'Etc/UTC', timezoneOffset: 0, isDst: false });
  });

  it("the 'UTC' alias, carrying the resolved identifier", () => {
    expect(wire(new DateTz(TS, 'UTC')).timezone).toBe('Etc/UTC');
  });
});

describe('a serialised instance can be rebuilt', () => {
  const d = new DateTz(TS, 'Europe/Rome');

  it('from its own JSON', () => {
    const back = new DateTz(wire(d) as IDateTz);
    expect(back).toEqual(d);
    expect(back.toString()).toBe(d.toString());
  });

  it('from a structured clone or a spread copy', () => {
    expect(new DateTz(structuredClone(d))).toEqual(d);
    expect(new DateTz({ ...d })).toEqual(d);
  });

  it('from a payload carrying only timestamp and timezone, as 2.1.8–3.0.1 wrote it', () => {
    expect(new DateTz({ timestamp: TS, timezone: 'Europe/Rome' })).toEqual(d);
  });

  it('re-resolving offset and DST rather than trusting the payload', () => {
    const tampered = { ...wire(d), timezoneOffset: 0, isDst: false };
    const back = new DateTz(tampered as IDateTz);
    expect(back.timezoneOffset).toBe(2 * HOUR);
    expect(back.isDst).toBe(true);
  });

  it('when nested inside a message payload', () => {
    const payload = wire({ bookingId: 42, start: d, end: new DateTz(TS + HOUR, 'Europe/Rome') });

    expect(payload.start).toEqual(ROME);
    expect(new DateTz(payload.start).toString()).toBe('2026-08-13 13:45:00');
    expect(new DateTz(payload.end).toString()).toBe('2026-08-13 14:45:00');
  });

  it('when inside an array', () => {
    const dates = [d, new DateTz(JAN, 'America/New_York')];
    const back = (wire(dates) as IDateTz[]).map(value => new DateTz(value));
    expect(back).toEqual(dates);
  });

  it('in a zone whose offset is not a whole hour', () => {
    const kolkata = new DateTz(TS, 'Asia/Kolkata');
    const back = new DateTz(wire(kolkata) as IDateTz);
    expect(back).toEqual(kolkata);
    expect(back.timezoneOffset).toBe(5 * HOUR + 30 * MINUTE);
  });
});
