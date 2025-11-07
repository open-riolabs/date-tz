import { DateTz } from './date-tz';

describe('DateTz', () => {
  it('should create an instance with the correct date and timezone', () => {
    const dateTz = new DateTz(1609459200000, "Etc/UTC");
    expect(dateTz.timestamp).toBe(1609459200000);
    expect(dateTz.timezone).toBe("Etc/UTC");
  });

  it('should create an instance with the correct UTC date and adjuste UTC IANA format timezone', () => {
    const dateTz = new DateTz(1609459200000, "UTC");
    expect(dateTz.timestamp).toBe(1609459200000);
    expect(dateTz.timezone).toBe("Etc/UTC");
  });


});