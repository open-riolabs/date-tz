import { DateTz } from '../src/date-tz';
import { IDateTz } from '../src/interfaces';

const TS = 1786621500000; // 2026-08-13 13:45:00 in Europe/Rome

/**
 * Instances travel between services as plain objects, so what
 * `JSON.stringify` produces is part of the contract: the constructor has to
 * accept its own output back.
 *
 * That broke when the two state fields were changed from public properties
 * to TypeScript `private` ones. `private` is erased at compile time — the
 * properties stayed enumerable at runtime, renamed with a leading
 * underscore — so serialising an instance emitted `_timestamp`/`_timezone`,
 * and rebuilding it read `undefined` from the names it expected.
 */
describe('an instance survives a round trip through JSON', () => {
  const d = new DateTz(TS, 'Europe/Rome');

  it('serialises the names the constructor reads', () => {
    expect(JSON.parse(JSON.stringify(d))).toEqual({
      timestamp: TS,
      timezone: 'Europe/Rome',
    });
  });

  it('exposes no underscore-prefixed state', () => {
    const wire = JSON.parse(JSON.stringify(d));
    expect(Object.keys(wire).filter(k => k.startsWith('_'))).toEqual([]);
    // Nothing enumerable on the instance at all: the state is private.
    expect(Object.keys(d)).toEqual([]);
  });

  it('rebuilds the same instant from its own output', () => {
    const back = new DateTz(JSON.parse(JSON.stringify(d)) as IDateTz);
    expect(back.timestamp).toBe(d.timestamp);
    expect(back.timezone).toBe(d.timezone);
    expect(back.toString()).toBe(d.toString());
  });

  it('re-derives offset and DST rather than carrying them over', () => {
    const wire = JSON.parse(JSON.stringify(d));
    // Derived state is deliberately absent from the payload...
    expect(wire.timezoneOffset).toBeUndefined();
    expect(wire.isDst).toBeUndefined();
    // ...and resolved again on the receiving side.
    const back = new DateTz(wire as IDateTz);
    expect(back.timezoneOffset).toBe(d.timezoneOffset);
    expect(back.isDst).toBe(d.isDst);
  });

  it('survives being nested inside a message payload', () => {
    const payload = { bookingId: 42, start: d, end: new DateTz(TS + 3600000, 'Europe/Rome') };
    const wire = JSON.parse(JSON.stringify(payload));

    expect(wire.start).toEqual({ timestamp: TS, timezone: 'Europe/Rome' });
    expect(new DateTz(wire.start).toString()).toBe('2026-08-13 13:45:00');
    expect(new DateTz(wire.end).toString()).toBe('2026-08-13 14:45:00');
  });

  it('round-trips a zone whose offset is not a whole hour', () => {
    const kolkata = new DateTz(TS, 'Asia/Kolkata');
    const back = new DateTz(JSON.parse(JSON.stringify(kolkata)) as IDateTz);
    expect(back.toString()).toBe(kolkata.toString());
    expect(back.timezoneOffset).toBe(19800000); // UTC+05:30
  });

  it('keeps toJSON usable on its own', () => {
    const json = d.toJSON();
    expect(json).toEqual({ timestamp: TS, timezone: 'Europe/Rome' });
    expect(new DateTz(json).toString()).toBe(d.toString());
  });
});
