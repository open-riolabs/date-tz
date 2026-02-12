import { canonicalLink, etc } from "./canonical-link";

export function getOffsetSeconds(timestamp: number, timezone: string): number {
  if (timezone === 'UTC') return 0;
  const baseOffset = tzDiscover(timestamp, timezone).offset;
  let timestampdiscovery = timestamp - (baseOffset - 60) * 60 * 1000;

  const arr: Array<{ offset: number, isDst: boolean; }> = [];
  const interval = 4;
  timestampdiscovery -= interval * 15 * 60 * 1000;

  for (const time2discover of Array.from({ length: interval * 2 }, (_, i) => timestampdiscovery + i * 15 * 60 * 1000)) {
    arr.push(tzDiscover(time2discover, timezone));
  }
  const first = arr[0];
  const last = arr[arr.length - 1];
  const delta = last.offset - first.offset;
  if (delta === 0) return first.offset * 60;
  if (delta > 0) {
    return first.offset * 60;
  }
  if (delta < 0) {
    return last.offset * 60;
  }
}

export function tzDiscover(timestamp: number, timezone: string): { offset: number, isDst: boolean; } {
  const formatterTZS = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'longOffset', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', });
  const formatterTZL = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'long', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', });
  const partsTZS = formatterTZS.formatToParts(timestamp);
  const partsTZL = formatterTZL.formatToParts(timestamp);
  const longName = getTimeFormatPart(partsTZL, 'timeZoneName')?.toLowerCase();
  const isDst = longName.includes('summer') || longName?.includes('daylight');

  const _timezone = getTimeFormatPart(partsTZS, 'timeZoneName');
  if (_timezone === 'UTC' || _timezone === 'GMT') return { isDst: false, offset: 0 };

  const match = _timezone.match(/^(?:GMT|UTC)?([+-])(\d{1,2})(?::(\d{2}))?$/i);
  if (!match) { throw new Error(`Unexpected timeZoneName format: ${_timezone}`); }
  const sign = match[1] === '+' ? 1 : -1;
  const hours = parseInt(match[2], 10);
  const mins = match[3] ? parseInt(match[3], 10) : 0;
  return { isDst, offset: sign * (hours * 60 + mins), hh: `${getTimeFormatPart(partsTZS, 'hour')}:${getTimeFormatPart(partsTZS, 'minute')}` } as any;
}

function getTimeFormatPart(parts: Intl.DateTimeFormatPart[], type: string) {
  const part = parts.find(p => p.type === type);
  if (!part) {
    throw new Error(`Missing part ${type}`);
  }
  return part.value;
};

function supportedTimeZones(): string[] {
  const canonical = Array.from(new Set([
    ...etc,
    ...Intl.supportedValuesOf('timeZone')
  ]));
  return canonical;
}

function fallbackTimeZone(timezone: string): string {
  if (supportedTimeZones().includes(timezone)) {
    return timezone;
  } else if (Object.keys(canonicalLink).includes(timezone) && supportedTimeZones().includes(canonicalLink[timezone])) {
    return canonicalLink[timezone];
  } else if (Object.values(canonicalLink).includes(timezone) && supportedTimeZones().includes(Object.entries(canonicalLink).find(([k, v]) => v === timezone)?.[0])) {
    return Object.entries(canonicalLink).find(([k, v]) => v === timezone)?.[0];
  } else {
    throw new Error(`Unsupported time zone: ${timezone}`);
  }
}
