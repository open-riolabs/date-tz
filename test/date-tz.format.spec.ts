import { DateTz } from '../src/date-tz';
import { TzProvider } from '../src/interfaces';
import { intlTzProvider, setTzProvider } from '../src/tz-provider';

const INSTANT = Date.UTC(2026, 5, 22, 13, 45, 30);

/**
 * Formatting and parsing used to recognise different sets of tokens, so a
 * pattern `toString` accepted was not necessarily one `parse` could read.
 * The mismatch was silent: the missing component fell back to its default
 * and the round trip returned a plausible, wrong date.
 */
describe('toString and parse agree on one token vocabulary', () => {
  const d = new DateTz(INSTANT, 'Etc/UTC');

  it.each([
    ['YYYY-MM-DD HH:mm:ss', '2026-06-22 13:45:30'],
    ['yyyy-MM-DD HH:mm:ss', '2026-06-22 13:45:30'],
    ['YY-MM-DD HH:mm:ss', '2026-06-22 13:45:30'],
    ['yy-MM-DD HH:mm:ss', '2026-06-22 13:45:30'],
    ['DD/MM/YYYY HH:mm:ss', '2026-06-22 13:45:30'],
    ['YYYY-MM-DD hh:mm:ss AA', '2026-06-22 13:45:30'],
    ['YYYY-MM-DD hh:mm:ss aa', '2026-06-22 13:45:30'],
    ['WS YYYY-MM-DD', '2026-06-22 00:00:00'],
    ['WL YYYY-MM-DD', '2026-06-22 00:00:00'],
    ['YYYY-MM-DD tz', '2026-06-22 00:00:00'],
  ])('round-trips %s', (pattern, expected) => {
    const rendered = d.toString(pattern);
    expect(DateTz.parse(rendered, pattern, 'Etc/UTC').toString()).toBe(expected);
  });

  // The four-digit token defaulted to 1970, which is truthy, so the
  // lowercase spelling could never win the fallback that selected it.
  it('reads yyyy rather than falling back to the epoch year', () => {
    expect(DateTz.parse('2026-06-22', 'yyyy-MM-DD', 'Etc/UTC').year).toBe(2026);
  });

  it('reads two-digit years into the 1970..2069 window', () => {
    expect(DateTz.parse('26-06-22', 'YY-MM-DD', 'Etc/UTC').year).toBe(2026);
    expect(DateTz.parse('69-06-22', 'yy-MM-DD', 'Etc/UTC').year).toBe(2069);
    expect(DateTz.parse('70-06-22', 'YY-MM-DD', 'Etc/UTC').year).toBe(1970);
    expect(DateTz.parse('99-06-22', 'YY-MM-DD', 'Etc/UTC').year).toBe(1999);
  });

  // Variable-width names used to shift every component that followed them.
  it('keeps components aligned after a variable-width name', () => {
    expect(DateTz.parse('Mon 2026-06-22', 'WS YYYY-MM-DD', 'Etc/UTC').toString()).toBe('2026-06-22 00:00:00');
    expect(DateTz.parse('Monday 2026-06-22', 'WL YYYY-MM-DD', 'Etc/UTC').toString()).toBe('2026-06-22 00:00:00');
    expect(DateTz.parse('2026-06-22 Europe/Rome', 'YYYY-MM-DD tz', 'Etc/UTC').toString()).toBe('2026-06-22 00:00:00');
  });

  it('still fills missing components with their floor', () => {
    expect(DateTz.parse('06-22', 'MM-DD', 'Etc/UTC').toString()).toBe('1970-06-22 00:00:00');
    expect(DateTz.parse('2026', 'YYYY', 'Etc/UTC').toString()).toBe('2026-01-01 00:00:00');
  });
});

/**
 * ISO 8601 writes the break between date and time as `T`; RFC 3339 §5.6
 * allows a space in its place. They mean the same thing, so a pattern
 * written with either accepts both — an HTML `datetime-local` input hands
 * over `2026-08-13T13:45` whatever separator the pattern happens to use.
 */
describe('the date/time separator accepts T and space alike', () => {
  it.each([
    ['2026-08-13T13:45', 'YYYY-MM-DD HH:mm'],
    ['2026-08-13 13:45', 'YYYY-MM-DD HH:mm'],
    ['2026-08-13T13:45', 'YYYY-MM-DDTHH:mm'],
    ['2026-08-13 13:45', 'YYYY-MM-DDTHH:mm'],
  ])('parses %s against %s', (input, pattern) => {
    expect(DateTz.parse(input, pattern, 'Etc/UTC').toString()).toBe('2026-08-13 13:45:00');
  });

  it('applies to patterns carrying seconds too', () => {
    expect(DateTz.parse('2026-08-13T13:45:30', 'YYYY-MM-DD HH:mm:ss', 'Etc/UTC').toString())
      .toBe('2026-08-13 13:45:30');
  });

  // The pattern says what to read, not everything the string may carry.
  it.each([
    ['fractional seconds', '2026-08-13T13:45:30.123'],
    ['a Zulu suffix', '2026-08-13T13:45:30Z'],
    ['a numeric offset', '2026-08-13T13:45:30+02:00'],
    ['both', '2026-08-13T13:45:30.123+02:00'],
  ])('reads an ISO value carrying %s', (_label, input) => {
    expect(DateTz.parse(input, 'YYYY-MM-DD HH:mm:ss', 'Etc/UTC').toString())
      .toBe('2026-08-13 13:45:30');
  });

  // The suffix is skipped, not honoured: the zone is the one passed in.
  it('leaves the timezone to the argument, not the suffix', () => {
    const d = DateTz.parse('2026-08-13T13:45:30+02:00', 'YYYY-MM-DD HH:mm:ss', 'Europe/Rome');
    expect(d.timezone).toBe('Europe/Rome');
    expect(d.toString()).toBe('2026-08-13 13:45:30');
  });

  it('reads a prefix when the pattern is shorter than the string', () => {
    expect(DateTz.parse('2026-08-13T13:45', 'YYYY-MM-DD', 'Etc/UTC').toString())
      .toBe('2026-08-13 00:00:00');
  });

  it('does not accept any other character as the separator', () => {
    expect(() => DateTz.parse('2026-08-13X13:45', 'YYYY-MM-DD HH:mm', 'Etc/UTC'))
      .toThrow(/does not match pattern/);
  });

  // Only a separator on its own is interchangeable — a T inside a longer
  // run of literal text belongs to that text.
  it('leaves a T inside a word literal', () => {
    expect(DateTz.parse('2026-08-13 GMT 13:45', 'YYYY-MM-DD GMT HH:mm', 'Etc/UTC').toString())
      .toBe('2026-08-13 13:45:00');
    expect(() => DateTz.parse('2026-08-13 GM 13:45', 'YYYY-MM-DD GMT HH:mm', 'Etc/UTC'))
      .toThrow(/does not match pattern/);
  });
});

describe('parse refuses what it cannot read instead of guessing', () => {
  it.each([
    ['LM DD, YYYY', 'June 22, 2026'],
    ['SM DD, YYYY', 'Jun 22, 2026'],
  ])('rejects the locale-dependent month token in %s', (pattern, input) => {
    expect(() => DateTz.parse(input, pattern, 'Etc/UTC')).toThrow(/cannot be parsed/);
  });

  it.each([
    ['separator mismatch', '2026-06-22', 'YYYY/MM/DD'],
    ['unpadded components', '26-6-2', 'YYYY-MM-DD'],
    ['truncated input', '2026-06', 'YYYY-MM-DD'],
    ['non-numeric component', 'abcd-06-22', 'YYYY-MM-DD'],
    ['a component the pattern needs but the string lacks', '2026-08-13T13:45', 'YYYY-MM-DD HH:mm:ss'],
  ])('rejects %s', (_label, input, pattern) => {
    expect(() => DateTz.parse(input, pattern, 'Etc/UTC')).toThrow(/does not match pattern/);
  });

  it('still requires an AM/PM marker alongside a 12-hour token', () => {
    expect(() => DateTz.parse('2026-06-22 01:45:30', 'YYYY-MM-DD hh:mm:ss', 'Etc/UTC'))
      .toThrow(/AM\/PM marker/);
  });

  it('names the pattern in the error, not the epoch', () => {
    // This input used to fail with "Dates before 1970-01-01 are not
    // supported", which pointed at the wrong thing entirely.
    expect(() => DateTz.parse('Mon 2026-06-22', 'YYYY-MM-DD', 'Etc/UTC'))
      .toThrow(/does not match pattern "YYYY-MM-DD"/);
  });
});

describe('name tokens render the wall clock this instance resolved', () => {
  afterEach(() => setTzProvider(null));

  /** Pins one zone to a fixed offset, deferring everything else. */
  const pinned = (zone: string, offset: number): TzProvider => ({
    offsetAt: (timestamp, timezone) => timezone === zone
      ? { offset, isDst: false }
      : intlTzProvider.offsetAt(timestamp, timezone),
  });

  // Numeric tokens come from the resolved offset while month and weekday
  // names came from Intl re-converting the instant itself. A provider that
  // disagrees with the runtime split the two apart, and a single toString()
  // could name a weekday that did not belong to the date beside it.
  it('agrees with the numeric tokens under a custom provider', () => {
    setTzProvider(pinned('Africa/Casablanca', 0));
    const d = new DateTz(Date.UTC(2026, 11, 21, 23, 30, 0), 'Africa/Casablanca');
    expect(d.toString('YYYY-MM-DD')).toBe('2026-12-21');
    expect(d.toString('WL')).toBe('Monday');   // the 21st was a Monday
    expect(d.toString('LM')).toBe('December');
  });

  it('agrees across a month boundary the provider moves', () => {
    setTzProvider(pinned('Europe/Rome', 0));
    const d = new DateTz(Date.UTC(2026, 6, 31, 23, 30, 0), 'Europe/Rome');
    // Rome would really be on UTC+2 here, putting this in August.
    expect(d.toString('YYYY-MM-DD')).toBe('2026-07-31');
    expect(d.toString('LM')).toBe('July');
    expect(d.toString('WL')).toBe('Friday');
  });

  it('matches the runtime when no provider is installed', () => {
    const d = new DateTz(Date.UTC(2026, 6, 31, 23, 30, 0), 'Europe/Rome');
    expect(d.toString('YYYY-MM-DD')).toBe('2026-08-01');
    expect(d.toString('LM')).toBe('August');
    expect(d.toString('WL')).toBe('Saturday');
  });
});
