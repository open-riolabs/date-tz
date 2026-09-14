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
 * Mesi e anni negativi che attraversano l'anno. Fino alla 2.1.4 `add` non
 * prendeva in prestito dall'anno: il mese sotto zero restava a gennaio, e
 * `set(1, 'day').add(-1, 'month')` — il «mese precedente» di rlb-calendar —
 * da gennaio 2027 restava su 2027-01-01. Dalla 2.1.5 `normalize` e
 * `clampToMonthEnd` portano il mese nell'anno in entrambe le direzioni; qui
 * si fissano i bordi, con la stessa regola di fine mese dei valori positivi.
 */
describe('negative months and years borrow from the year and clamp to the end of the month', () => {
  const at = (s: string, tz = 'Etc/UTC') => DateTz.parse(s, 'YYYY-MM-DD HH:mm:ss', tz);

  it('steps back from January into December of the previous year', () => {
    expect(at('2027-01-15 12:00:00').add(-1, 'month').toString()).toBe('2026-12-15 12:00:00');
    expect(at('2027-01-31 12:00:00').add(-1, 'month').toString()).toBe('2026-12-31 12:00:00');
  });

  it('goes to the first of the previous month the way rlb-calendar does', () => {
    expect(at('2027-01-15 00:00:00').set(1, 'day').add(-1, 'month').toString()).toBe('2026-12-01 00:00:00');
  });

  it.each([
    ['2027-01-15 12:00:00', -12, '2026-01-15 12:00:00'],
    ['2027-01-15 12:00:00', -13, '2025-12-15 12:00:00'],
    ['2027-01-15 12:00:00', -24, '2025-01-15 12:00:00'],
    ['2027-01-15 12:00:00', -25, '2024-12-15 12:00:00'],
  ])('%s %s months -> %s', (start, months, expected) => {
    expect(at(start).add(months, 'month').toString()).toBe(expected);
  });

  it.each([
    ['2027-03-31 12:00:00', -1, '2027-02-28 12:00:00'],
    ['2024-03-31 12:00:00', -1, '2024-02-29 12:00:00'],
    ['2027-03-31 12:00:00', -13, '2026-02-28 12:00:00'],
    ['2025-03-31 12:00:00', -13, '2024-02-29 12:00:00'],
    ['2027-01-31 12:00:00', -11, '2026-02-28 12:00:00'],
    ['2028-02-29 12:00:00', -12, '2027-02-28 12:00:00'],
    ['2028-02-29 12:00:00', -48, '2024-02-29 12:00:00'],
  ])('%s %s months clamps to %s', (start, months, expected) => {
    expect(at(start).add(months, 'month').toString()).toBe(expected);
  });

  it.each([
    ['2027-01-01 12:00:00', -1, '2026-01-01 12:00:00'],
    ['2024-02-29 12:00:00', -1, '2023-02-28 12:00:00'],
    ['2024-02-29 12:00:00', -4, '2020-02-29 12:00:00'],
    // Il 2100 non è bisestile, il 2000 sì: la regola dei secoli vale anche all'indietro.
    ['2104-02-29 12:00:00', -4, '2100-02-28 12:00:00'],
    ['2004-02-29 12:00:00', -4, '2000-02-29 12:00:00'],
  ])('%s %s years -> %s', (start, years, expected) => {
    expect(at(start).add(years, 'year').toString()).toBe(expected);
  });

  it('borrows on the local wall clock when UTC sits in another month', () => {
    // A Tokyo il 1° gennaio alle 05:00 in UTC è ancora il 31 dicembre.
    expect(at('2027-01-01 05:00:00', 'Asia/Tokyo').add(-1, 'month').toString()).toBe('2026-12-01 05:00:00');
    // A New York il 31 gennaio alle 23:30 in UTC è già febbraio.
    expect(at('2027-01-31 23:30:00', 'America/New_York').add(-1, 'month').toString()).toBe('2026-12-31 23:30:00');
  });

  it('keeps the clock time when the month back crosses a DST change', () => {
    // Roma passa all'ora legale il 29 marzo 2026: dal 15 aprile un mese indietro
    // torna all'ora solare, con la stessa ora sul quadrante e l'offset di un'ora.
    const d = at('2026-04-15 12:00:00', 'Europe/Rome').add(-1, 'month');
    expect(d.toString()).toBe('2026-03-15 12:00:00');
    expect(d.timezoneOffset).toBe(3600000);
  });

  it('is undone by the matching addition across the year', () => {
    const start = at('2027-01-15 12:00:00');
    expect(at('2027-01-15 12:00:00').add(-13, 'month').add(13, 'month').timestamp).toBe(start.timestamp);
    expect(at('2027-01-15 12:00:00').add(-3, 'year').add(3, 'year').timestamp).toBe(start.timestamp);
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
