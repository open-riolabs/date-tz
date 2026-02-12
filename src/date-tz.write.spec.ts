import { DateTz } from "./date-tz";

describe('DateTz.now', () => {

  it('returns a current timestamp in requested timezone', () => {
    const nowRome = DateTz.now('Europe/Rome');
    expect(nowRome.timezone).toBe('Europe/Rome');
    expect(typeof nowRome.timestamp).toBe('number');
  });

  it('returns a current timestamp in requested timezone', () => {
    const nowLA = DateTz.now('America/Los_Angeles');
    expect(nowLA.timezone).toBe('America/Los_Angeles');
    expect(typeof nowLA.timestamp).toBe('number');
  });

  it('should add two timestamp', () => {
    const ts1 = new DateTz(1741485600000, "UTC");
    const ts2 = new DateTz(ts1).add(1, "day");
    expect(ts2.timezone).toBe(ts1.timezone);
    expect(ts2.timestamp).toBe(ts1.timestamp + 60 * 60 * 24 * 1000);
  });

  it('should subtract two timestamp', () => {
    const ts1 = new DateTz(1741485600000, "UTC");
    const ts2 = new DateTz(ts1).add(-1, "day");
    expect(ts2.timezone).toBe(ts1.timezone);
    expect(ts2.timestamp).toBe(ts1.timestamp - 60 * 60 * 24 * 1000);
  });

  it('should compare two timestamp', () => {
    const ts1 = new DateTz(1741485600000, "UTC");
    const ts2 = new DateTz(ts1).add(1, "day");
    const ts3 = ts2.compare!(ts1);
    expect(ts3).toBe(ts2.timestamp - ts1.timestamp);
  });

  it("returns a parsed timestamp in requested timezone", () => {
    const parsed = DateTz.parse("2025-11-06 23:05:00", "YYYY-MM-DD HH:mm:ss", "America/New_York");
    expect(parsed.timezone).toBe('America/New_York');
    expect(parsed.timestamp).toBe(1762488300000);
  });

  it("returns a parsed timestamp in requested timezone", () => {
    const parsed = DateTz.parse("2026-10-24 02:00:54", "YYYY-MM-DD HH:mm:ss", "Europe/Rome");
    expect(parsed.timezone).toBe('Europe/Rome');
    expect(parsed.timestamp).toBe(1792800054000);
  });

  it("returns a parsed timestamp in requested timezone", () => {
    const parsed = DateTz.parse("2026-12-22 13:23:54", "YYYY-MM-DD HH:mm:ss", "Africa/Casablanca");
    expect(parsed.timezone).toBe('Africa/Casablanca');
    expect(parsed.timestamp).toBe(1797942234000);
  });

  it("returns a parsed timestamp in requested timezone", () => {
    const parsed = DateTz.parse("2025-03-15 19:40:00", "YYYY-MM-DD HH:mm:ss", "Asia/Dubai");
    expect(parsed.timezone).toBe('Asia/Dubai');
    expect(parsed.timestamp).toBe(1742053200000);
  });

  it("returns a parsed timestamp in requested timezone", () => {
    const parsed = DateTz.parse("2025-03-16 00:40:00", "YYYY-MM-DD HH:mm:ss", "Asia/Tokyo");
    expect(parsed.timezone).toBe('Asia/Tokyo');
    expect(parsed.timestamp).toBe(1742053200000);
  });

  it("returns a parsed timestamp in requested timezone", () => {
    const parsed = DateTz.parse("2025-03-30 03:59:00", "YYYY-MM-DD HH:mm:ss", "Europe/Rome");
    expect(parsed.timezone).toBe('Europe/Rome');
    expect(parsed.timestamp).toBe(1743299940000);
  });

  it("returns a parsed timestamp in requested timezone", () => {
    const parsed = DateTz.parse("2025-03-30 04:00:00", "YYYY-MM-DD HH:mm:ss", "Europe/Rome");
    expect(parsed.timezone).toBe('Europe/Rome');
    expect(parsed.timestamp).toBe(1743300000000);
  });

  it("returns a parsed timestamp in requested timezone", () => {
    const parsed = DateTz.parse("2025-10-25 22:59:00", "YYYY-MM-DD HH:mm:ss", "America/Toronto");
    expect(parsed.timezone).toBe('America/Toronto');
    expect(parsed.timestamp).toBe(1761447540000);
  });

  it("returns a parsed timestamp in requested timezone", () => {
    const parsed = DateTz.parse("2025-11-01 20:00:00", "YYYY-MM-DD HH:mm:ss", "America/Toronto");
    expect(parsed.timezone).toBe('America/Toronto');
    expect(parsed.timestamp).toBe(1762041600000);
  });

  it("returns a parsed timestamp in requested timezone", () => {
    const parsed = DateTz.parse("2025-11-01 19:59:00", "YYYY-MM-DD HH:mm:ss", "America/Toronto");
    expect(parsed.timezone).toBe('America/Toronto');
    expect(parsed.timestamp).toBe(1762041540000);
  });

  it("returns a parsed timestamp in requested timezone", () => {
    const parsed = DateTz.parse("2025-07-01 12:00:00", "YYYY-MM-DD HH:mm:ss", "Pacific/Honolulu");
    expect(parsed.timezone).toBe('Pacific/Honolulu');
    expect(parsed.timestamp).toBe(1751407200000);
  });

  it("returns a parsed timestamp in requested timezone", () => {
    const parsed = DateTz.parse("2025-01-15 08:30:00", "YYYY-MM-DD HH:mm:ss", "Pacific/Auckland");
    expect(parsed.timezone).toBe('Pacific/Auckland');
    expect(parsed.timestamp).toBe(1736883000000);
  });

  it("returns a parsed timestamp in requested timezone", () => {
    const parsed = DateTz.parse("2025-01-15 08:00:00", "YYYY-MM-DD HH:mm:ss", "Australia/Sydney");
    expect(parsed.timezone).toBe('Australia/Sydney');
    expect(parsed.timestamp).toBe(1736888400000);
  });

  it("returns a parsed timestamp in requested timezone", () => {
    const parsed = DateTz.parse("2025-01-15 08:00:00", "YYYY-MM-DD HH:mm:ss", "Australia/Perth");
    expect(parsed.timezone).toBe('Australia/Perth');
    expect(parsed.timestamp).toBe(1736899200000);
  });

  it("returns a parsed timestamp in requested timezone", () => {
    const parsed = DateTz.parse("2025-01-15 08:00:00", "YYYY-MM-DD HH:mm:ss", "Australia/Adelaide");
    expect(parsed.timezone).toBe('Australia/Adelaide');
    expect(parsed.timestamp).toBe(1736890200000);
  });

  it("returns a parsed timestamp in requested timezone", () => {
    const parsed = DateTz.parse("2025-01-15 12:00:00", "YYYY-MM-DD HH:mm:ss", "Africa/Cairo");
    expect(parsed.timezone).toBe('Africa/Cairo');
    expect(parsed.timestamp).toBe(1736935200000);
  });

  it("returns a parsed timestamp in requested timezone", () => {
    const parsed = DateTz.parse("2025-04-25 01:00:00", "YYYY-MM-DD HH:mm:ss", "Africa/Cairo");
    expect(parsed.timezone).toBe('Africa/Cairo');
    expect(parsed.timestamp).toBe(1745532000000);
  });

  it("returns a parsed timestamp in requested timezone", () => {
    const parsed = DateTz.parse("2025-07-15 12:00:00", "YYYY-MM-DD HH:mm:ss", "Africa/Cairo");
    expect(parsed.timezone).toBe('Africa/Cairo');
    expect(parsed.timestamp).toBe(1752570000000);
  });

  it("returns a parsed timestamp in requested timezone", () => {
    const parsed = DateTz.parse("2025-01-15 12:00:00", "YYYY-MM-DD HH:mm:ss", "Africa/Lagos");
    expect(parsed.timezone).toBe('Africa/Lagos');
    expect(parsed.timestamp).toBe(1736938800000);
  });

  it("returns a parsed timestamp in requested timezone", () => {
    const parsed = DateTz.parse("2025-06-15 10:20:30", "YYYY-MM-DD HH:mm:ss", "Europe/Berlin");
    expect(parsed.timezone).toBe('Europe/Berlin');
    expect(parsed.timestamp).toBe(1749975630000);
  });

  it("returns a parsed timestamp in requested timezone", () => {
    const parsed = DateTz.parse("2026-04-04 16:30:00", "YYYY-MM-DD HH:mm:ss", "Pacific/Auckland");
    expect(parsed.timezone).toBe('Pacific/Auckland');
    expect(parsed.timestamp).toBe(1775273400000);
  });

});
