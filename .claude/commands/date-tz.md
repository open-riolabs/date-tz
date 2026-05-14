# date-tz skill

You are working in a project that uses the **date-tz** library for all date/time handling. Apply the rules below to every piece of TypeScript/JavaScript code you write or review.

---

## Core rule: never use native `Date` for business logic

The `Date` object is **banned** for creating or manipulating dates in application code. The only permitted use is `Date.now()` inside the library itself. In application code:

- Do **not** write `new Date(...)`, `Date.parse(...)`, `new Date().getTime()`, etc.
- Use `DateTz.now(tz?)` to get the current instant.
- Use `DateTz.parse(str, pattern?, tz?)` to parse a string.
- Use `new DateTz(timestamp, tz?)` when you already have a millisecond timestamp.
- Use `new DateTz(iDateTz)` to materialise an `IDateTz` value into a concrete instance.

---

## Interface vs implementation

| Context | Type to use |
|---|---|
| Function/method parameter | `IDateTz` |
| Interface property | `IDateTz` |
| Return type of a public function | `IDateTz` |
| Local variable that needs to call methods | `IDateTz` (assign from `new DateTz(...)`) |
| Constructing a new value | `new DateTz(...)` |
| Static factory calls | `DateTz.now()`, `DateTz.parse()` |

**Rule:** use `IDateTz` everywhere you declare a type. Use `new DateTz(param)` at the top of any function that receives an `IDateTz` and needs to call methods on it.

```typescript
import { DateTz, IDateTz } from 'date-tz';

// CORRECT – interface in signature, concrete at the start of the body
function formatAppointment(date: IDateTz, tz: string): string {
  const d: IDateTz = new DateTz(date); // materialise once
  return d.toString!('DD/MM/YYYY HH:mm', 'it');
}

// WRONG – using DateTz as the parameter type
function formatAppointment(date: DateTz, tz: string): string { ... }
```

---

## Imports

```typescript
import { DateTz, IDateTz } from 'date-tz';
```

---

## Constructors

```typescript
// From a timestamp (ms since Unix epoch) + optional IANA timezone
const d: IDateTz = new DateTz(1700000000000, 'Europe/Rome');

// From another IDateTz (copies timestamp and timezone)
const copy: IDateTz = new DateTz(existingIDateTz);

// Defaults to 'Etc/UTC' when timezone is omitted
const utc: IDateTz = new DateTz(1700000000000);
```

---

## Static factory methods

```typescript
// Current instant
const now: IDateTz = DateTz.now('Europe/Rome');
const nowUtc: IDateTz = DateTz.now(); // Etc/UTC

// Parse a formatted string
const d: IDateTz = DateTz.parse('2024-01-15 09:30:00', 'YYYY-MM-DD HH:mm:ss', 'America/New_York');
const d2: IDateTz = DateTz.parse('15/01/2024', 'DD/MM/YYYY', 'Europe/Rome');

// 12-hour format requires aa or AA
const d3: IDateTz = DateTz.parse('01/15/2024 09:30 AM', 'MM/DD/YYYY hh:mm AA', 'Etc/UTC');

// List available timezones
const allTz: string[] = DateTz.timezones();
const supported: string[] = DateTz.supportedTimeZones();
```

---

## Properties (all read-only getters)

```typescript
const d: IDateTz = new DateTz(ts, 'Europe/Rome');

// Local (timezone-aware) components
d.year        // full year, e.g. 2024
d.month       // 0-based month index (0 = January … 11 = December)
d.day         // day of month, 1–31
d.hour        // 0–23
d.minute      // 0–59
d.dayOfWeek   // 0 = Sunday … 6 = Saturday

// UTC components
d.yearUTC
d.monthUTC
d.dayUTC
d.hourUTC
d.minuteUTC
d.dayOfWeekUTC

// Metadata
d.timestamp        // ms since Unix epoch
d.timezone         // IANA string, e.g. 'Europe/Rome'
d.timezoneOffset   // UTC offset in milliseconds
d.isDst            // true when DST is active
d.isLeapYear       // true when current year is a leap year
```

> **Note:** `month` and `monthUTC` are **0-based** (January = 0, December = 11).

---

## `toString` – formatting

```typescript
const d: IDateTz = new DateTz(ts, 'Europe/Rome');

d.toString!()                          // '2024-01-15 09:30:00' (default)
d.toString!('DD/MM/YYYY')              // '15/01/2024'
d.toString!('DD LM YYYY', 'it')        // '15 gennaio 2024'
d.toString!('WL, DD MM YYYY', 'en')    // 'Monday, 15 01 2024'
d.toString!('hh:mm AA')               // '09:30 AM'
```

**Format tokens:**

| Token | Meaning |
|---|---|
| `YYYY` / `yyyy` | 4-digit year |
| `YY` / `yy` | 2-digit year |
| `MM` | 2-digit month (01–12) |
| `LM` | Long month name (locale-aware) |
| `SM` | Short month name (locale-aware) |
| `DD` | 2-digit day (01–31) |
| `HH` | 24-hour hour (00–23) |
| `hh` | 12-hour hour (01–12) |
| `mm` | Minutes (00–59) |
| `ss` | Seconds (00–59) |
| `AA` | AM/PM uppercase |
| `aa` | am/pm lowercase |
| `WL` | Long weekday name (locale-aware) |
| `WS` | Short weekday name (locale-aware) |
| `tz` | Timezone identifier |

---

## `add` – arithmetic

Returns `IDateTz` (mutates the instance in place).

```typescript
let d: IDateTz = new DateTz(ts, 'Europe/Rome');

d = d.add!(1, 'hour');
d = d.add!(30, 'minute');
d = d.add!(1, 'day');
d = d.add!(2, 'month');
d = d.add!(1, 'year');
d = d.add!(500, 'millisecond');
d = d.add!(10, 'second');
```

---

## `set` – override a component

Returns `IDateTz` (mutates the instance in place).

```typescript
let d: IDateTz = new DateTz(ts, 'Europe/Rome');

d = d.set!(2025, 'year');
d = d.set!(6,    'month');    // 1-based: 1 = January … 12 = December
d = d.set!(15,   'day');      // 1–31
d = d.set!(9,    'hour');     // 0–23
d = d.set!(0,    'minute');   // 0–59
d = d.set!(0,    'second');   // 0–59
d = d.set!(0,    'millisecond'); // 0–999
```

> **Note:** `set('month', …)` is **1-based** (pass `6` for June), unlike the `month` getter which is 0-based.

---

## `stripSecMillis` – truncate to the minute

```typescript
let d: IDateTz = new DateTz(ts, 'Europe/Rome');
d = d.stripSecMillis!(); // seconds and milliseconds become 0
```

---

## `cloneToTimezone` – immutable timezone conversion

Creates a **new** instance at the same absolute instant, displayed in a different timezone.

```typescript
const rome: IDateTz = new DateTz(ts, 'Europe/Rome');
const ny: IDateTz = rome.cloneToTimezone!('America/New_York');
// rome and ny share the same timestamp; only timezone (and derived components) differ
```

---

## `setTimezone` – mutate the timezone in place

Changes the timezone of an existing instance. The UTC timestamp is **preserved**; offset and DST are recomputed.

```typescript
let d: IDateTz = new DateTz(ts, 'Europe/Rome');
d = d.setTimezone('Asia/Tokyo');
```

---

## `compare` and `isComparable`

`compare` throws if the two instances are in different timezones. Always check `isComparable` first, or ensure both dates share a timezone.

```typescript
function sortDates(a: IDateTz, b: IDateTz): number {
  const da: IDateTz = new DateTz(a);
  const db: IDateTz = new DateTz(b);
  if (!da.isComparable!(db)) {
    throw new Error(`Cannot compare ${da.timezone} with ${db.timezone}`);
  }
  return da.compare!(db); // negative / 0 / positive
}
```

---

## Full worked example

```typescript
import { DateTz, IDateTz } from 'date-tz';

interface Meeting {
  title: string;
  start: IDateTz;
  end: IDateTz;
}

function scheduleMeeting(title: string, startTs: number, durationMinutes: number, tz: string): Meeting {
  const start: IDateTz = new DateTz(startTs, tz);
  const end: IDateTz = new DateTz(startTs, tz).add!(durationMinutes, 'minute');
  return { title, start, end };
}

function formatMeeting(meeting: Meeting, locale: string): string {
  const s: IDateTz = new DateTz(meeting.start);
  const e: IDateTz = new DateTz(meeting.end);
  const date = s.toString!('WL DD LM YYYY', locale);
  const from = s.toString!('HH:mm');
  const to   = e.toString!('HH:mm tz');
  return `${meeting.title} — ${date}, ${from}–${to}`;
}

function isTodayMeeting(meeting: Meeting): boolean {
  const now: IDateTz = DateTz.now(meeting.start.timezone);
  const s: IDateTz = new DateTz(meeting.start);
  return s.year === now.year && s.month === now.month && s.day === now.day;
}
```

---

## Common mistakes to avoid

```typescript
// WRONG – native Date
const now = new Date();
const ts = new Date('2024-01-15').getTime();

// CORRECT
const now: IDateTz = DateTz.now('Europe/Rome');
const d: IDateTz   = DateTz.parse('2024-01-15', 'YYYY-MM-DD', 'Europe/Rome');

// WRONG – DateTz as parameter type
function fn(d: DateTz) { ... }

// CORRECT
function fn(d: IDateTz) { const inst: IDateTz = new DateTz(d); ... }

// WRONG – comparing dates in different timezones without cloning
function diff(a: IDateTz, b: IDateTz): number {
  return a.compare!(b); // may throw
}

// CORRECT – normalise to same timezone first
function diff(a: IDateTz, b: IDateTz): number {
  const da: IDateTz = new DateTz(a);
  const db: IDateTz = da.isComparable!(b) ? new DateTz(b) : b.cloneToTimezone!(a.timezone!);
  return da.compare!(db);
}

// WRONG – forgetting that month getter is 0-based
if (d.month === 6) { ... } // this is July, not June!

// CORRECT – remember month getter is 0-based (0 = January)
if (d.month === 5) { ... } // June

// WRONG – using set('month') with 0-based value
d.set!(5, 'month'); // would set to May (set expects 1-based)

// CORRECT – set('month') is 1-based
d.set!(6, 'month'); // June
```
