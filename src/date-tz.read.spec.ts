import { DateTz } from './date-tz';

describe('DateTz.toString formatting', () => {
  it('uses default pattern when none provided', () => {
    const d = new DateTz(1762488300000, 'America/New_York');
    expect(d.toString()).toBe('2025-11-06 23:05:00');
  });

  it('uses default pattern when none provided', () => {
    const d = new DateTz(1792800054000, 'Europe/Rome');
    expect(d.toString()).toBe('2026-10-24 02:00:54');
  });

  it('uses default pattern when none provided', () => {
    const d = new DateTz(1797942234000, 'Africa/Casablanca');
    expect(d.toString()).toBe('2026-12-22 13:23:54');
  });

  it('uses default pattern when none provided', () => {
    const d = new DateTz(1742053200000, 'Asia/Dubai');
    expect(d.toString()).toBe('2025-03-15 19:40:00');
  });

  it('uses default pattern when none provided', () => {
    const d = new DateTz(1742053200000, 'Asia/Tokyo');
    expect(d.toString()).toBe('2025-03-16 00:40:00');
  });

  it('uses default pattern when none provided', () => {
    const d = new DateTz(1743299940000, 'Europe/Rome');
    expect(d.toString()).toBe('2025-03-30 03:59:00');
  });

  it('uses default pattern when none provided', () => {
    const d = new DateTz(1743300000000, 'Europe/Rome');
    expect(d.toString()).toBe('2025-03-30 04:00:00');
  });

  it('uses default pattern when none provided', () => {
    const d = new DateTz(1761447540000, 'America/Toronto');
    expect(d.toString()).toBe('2025-10-25 22:59:00');
  });

  it('uses default pattern when none provided', () => {
    const d = new DateTz(1762041600000, 'America/Toronto');
    expect(d.toString()).toBe('2025-11-01 20:00:00');
  });

  it('uses default pattern when none provided', () => {
    const d = new DateTz(1762041540000, 'America/Toronto');
    expect(d.toString()).toBe('2025-11-01 19:59:00');
  });

  it('uses default pattern when none provided', () => {
    const d = new DateTz(1741485600000, 'America/Toronto');
    expect(d.toString()).toBe('2025-03-08 21:00:00');
  });

});

describe('DateTz cross-timezone read (sender/reader use case)', () => {
  // A message sent at 08:00 on 2026-01-15 in Europe/Rome (CET, UTC+1)
  // is the instant 07:00 UTC. A reader in Asia/Tokyo (JST, UTC+9) should
  // see it as 16:00 on the same calendar day.
  const italianMorning = DateTz.parse('2026-01-15 08:00:00', 'YYYY-MM-DD HH:mm:ss', 'Europe/Rome');

  it('readIn renders the reader\'s wall clock without mutating the sender instance', () => {
    const forTokyo = italianMorning.readIn('Asia/Tokyo');
    expect(forTokyo.toString()).toBe('2026-01-15 16:00:00');
    // original is untouched
    expect(italianMorning.toString()).toBe('2026-01-15 08:00:00');
    expect(italianMorning.timezone).toBe('Europe/Rome');
  });

  it('readIn preserves the absolute instant (timestamp)', () => {
    const forTokyo = italianMorning.readIn('Asia/Tokyo');
    expect(forTokyo.timestamp).toBe(italianMorning.timestamp);
  });

  it('cloneToTimezone recomputes offset and getters for the new zone', () => {
    const clone = italianMorning.cloneToTimezone('Asia/Tokyo');
    expect(clone.hour).toBe(16);
    expect(clone.day).toBe(15);
    expect(clone.month).toBe(0); // January, zero-based
  });

  it('convertToTimezone mutates in place and recomputes offset', () => {
    const d = DateTz.parse('2026-01-15 08:00:00', 'YYYY-MM-DD HH:mm:ss', 'Europe/Rome');
    d.convertToTimezone!('Asia/Tokyo');
    expect(d.timezone).toBe('Asia/Tokyo');
    expect(d.toString!()).toBe('2026-01-15 16:00:00');
    expect(d.hour).toBe(16);
  });

  it('readIn handles DST: summer Rome -> Tokyo (no DST in Japan)', () => {
    // 08:00 CEST on 2026-07-15 is 06:00 UTC, which is 15:00 JST.
    const summerMorning = DateTz.parse('2026-07-15 08:00:00', 'YYYY-MM-DD HH:mm:ss', 'Europe/Rome');
    expect(summerMorning.readIn('Asia/Tokyo').toString()).toBe('2026-07-15 15:00:00');
  });
});
