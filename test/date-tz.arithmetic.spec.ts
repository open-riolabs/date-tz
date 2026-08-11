import { DateTz } from '../src/date-tz';

const utc = (y: number, m: number, d: number, h = 12) => new DateTz(Date.UTC(y, m, d, h, 0, 0), 'Etc/UTC');

/**
 * Adding a month to a date the target month does not have used to carry the
 * overflow forward, turning 31 January into 3 March. Every other calendar
 * library reads that as "the end of February" instead, and so does this one
 * now — while ordinary day arithmetic still carries.
 */
describe('month and year arithmetic clamps to the end of the month', () => {
  it.each([
    ['2026-01-31', 1, '2026-02-28'],
    ['2026-01-31', 3, '2026-04-30'],
    ['2026-01-31', 12, '2027-01-31'],
    ['2026-03-31', -1, '2026-02-28'],
    ['2026-05-31', -3, '2026-02-28'],
    ['2024-01-31', 1, '2024-02-29'],
  ])('%s + %s months -> %s', (start, months, expected) => {
    const d = DateTz.parse(start, 'YYYY-MM-DD', 'Etc/UTC');
    expect(d.add(months, 'month').toString('YYYY-MM-DD')).toBe(expected);
  });

  it('clamps 29 February when the target year is not a leap year', () => {
    const d = DateTz.parse('2024-02-29', 'YYYY-MM-DD', 'Etc/UTC');
    expect(d.add(1, 'year').toString('YYYY-MM-DD')).toBe('2025-02-28');
  });

  it('keeps a leap day when the target year has one', () => {
    const d = DateTz.parse('2024-02-29', 'YYYY-MM-DD', 'Etc/UTC');
    expect(d.add(4, 'year').toString('YYYY-MM-DD')).toBe('2028-02-29');
  });

  it('still carries day arithmetic across month boundaries', () => {
    expect(utc(2026, 0, 15).add(40, 'day').toString('YYYY-MM-DD')).toBe('2026-02-24');
    expect(utc(2026, 0, 31).add(1, 'day').toString('YYYY-MM-DD')).toBe('2026-02-01');
    expect(utc(2026, 0, 1).add(-1, 'day').toString('YYYY-MM-DD')).toBe('2025-12-31');
  });

  it('clamps set() the same way', () => {
    expect(DateTz.parse('2026-01-31', 'YYYY-MM-DD', 'Etc/UTC').set(2, 'month').toString('YYYY-MM-DD')).toBe('2026-02-28');
    expect(DateTz.parse('2024-02-29', 'YYYY-MM-DD', 'Etc/UTC').set(2025, 'year').toString('YYYY-MM-DD')).toBe('2025-02-28');
    expect(DateTz.parse('2026-02-10', 'YYYY-MM-DD', 'Etc/UTC').set(31, 'day').toString('YYYY-MM-DD')).toBe('2026-02-28');
  });
});

/**
 * Arithmetic used to run on the UTC wall clock, so adding a day to a date in
 * a zone an hour off UTC moved the local clock too, and `set` assigned a UTC
 * component the caller had not asked about.
 */
describe('calendar units move the local wall clock, time units move the instant', () => {
  // Rome springs forward on 2025-03-30 at 02:00.
  const beforeSpring = () => DateTz.parse('2025-03-29 12:00:00', 'YYYY-MM-DD HH:mm:ss', 'Europe/Rome');

  it('keeps the clock time when a day crosses a spring-forward', () => {
    const d = beforeSpring().add(1, 'day');
    expect(d.toString()).toBe('2025-03-30 12:00:00');
    expect(d.timezoneOffset).toBe(7200000);
    // That day was 23 hours long, and the instant reflects it.
    expect(d.timestamp - beforeSpring().timestamp).toBe(23 * 3600000);
  });

  it('keeps the clock time when a day crosses a fall-back', () => {
    // Rome falls back on 2025-10-26 at 03:00.
    const start = DateTz.parse('2025-10-25 12:00:00', 'YYYY-MM-DD HH:mm:ss', 'Europe/Rome');
    const d = DateTz.parse('2025-10-25 12:00:00', 'YYYY-MM-DD HH:mm:ss', 'Europe/Rome').add(1, 'day');
    expect(d.toString()).toBe('2025-10-26 12:00:00');
    expect(d.timestamp - start.timestamp).toBe(25 * 3600000);
  });

  it('adds hours as exact elapsed time, not calendar time', () => {
    const d = beforeSpring().add(24, 'hour');
    // 24 real hours across a 23-hour day land an hour later on the clock.
    expect(d.toString()).toBe('2025-03-30 13:00:00');
    expect(d.timestamp - beforeSpring().timestamp).toBe(24 * 3600000);
  });

  it.each([
    ['millisecond', 1500, 1500],
    ['second', 90, 90000],
    ['minute', 45, 2700000],
    ['hour', 5, 18000000],
  ] as const)('adds %s as exact elapsed time', (unit, value, expectedMs) => {
    const start = beforeSpring();
    const d = beforeSpring().add(value, unit);
    expect(d.timestamp - start.timestamp).toBe(expectedMs);
  });

  it('sets the local component, not the UTC one', () => {
    const d = new DateTz(Date.UTC(2026, 6, 15, 22, 0, 0), 'Asia/Tokyo');
    expect(d.toString()).toBe('2026-07-16 07:00:00');
    d.set(9, 'hour');
    expect(d.toString()).toBe('2026-07-16 09:00:00');
    expect(d.hour).toBe(9);
    // Setting the hour no longer drags the local date backwards.
    expect(d.day).toBe(16);
  });

  it('resolves a wall clock the transition skipped', () => {
    // 02:30 does not exist on 2025-03-30 in Rome; it shifts by the gap.
    const d = DateTz.parse('2025-03-29 02:30:00', 'YYYY-MM-DD HH:mm:ss', 'Europe/Rome').add(1, 'day');
    expect(d.toString()).toBe('2025-03-30 03:30:00');
  });

  it('strips seconds off the local clock', () => {
    const d = new DateTz(Date.UTC(2026, 6, 15, 10, 30, 45, 123), 'Asia/Kolkata');
    // A zone at UTC+05:30 — the half hour must survive the truncation.
    expect(d.stripSecMillis().toString()).toBe('2026-07-15 16:00:00');
    expect(d.second).toBe(0);
    expect(d.millisecond).toBe(0);
    expect(d.minute).toBe(0);
  });
});

describe('second and millisecond getters', () => {
  it('read the local components', () => {
    const d = new DateTz(Date.UTC(2026, 5, 22, 13, 45, 30, 123), 'Europe/Rome');
    expect(d.second).toBe(30);
    expect(d.millisecond).toBe(123);
  });

  it('read the UTC components', () => {
    const d = new DateTz(Date.UTC(2026, 5, 22, 13, 45, 30, 123), 'Europe/Rome');
    expect(d.secondUTC).toBe(30);
    expect(d.millisecondUTC).toBe(123);
  });

  it('agree with what toString renders', () => {
    const d = new DateTz(Date.UTC(2026, 5, 22, 13, 45, 30, 123), 'Asia/Kolkata');
    expect(d.toString('ss')).toBe(String(d.second).padStart(2, '0'));
  });
});
