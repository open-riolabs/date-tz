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
