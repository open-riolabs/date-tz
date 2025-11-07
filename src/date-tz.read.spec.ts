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
