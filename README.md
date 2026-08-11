# DateTz

A lightweight TypeScript date-time utility with full timezone support, custom formatting, parsing, and manipulation — built on the `Intl` API with no external dependencies.

---

## Installation

```ts
import { DateTz } from '@open-rlb/date-tz';
```

---

## Constructor

```ts
new DateTz(value: IDateTz)
new DateTz(value: number, tz?: string)
```

Accepts either an existing `IDateTz` object or a Unix timestamp (milliseconds) with an optional IANA timezone string. Defaults to `Etc/UTC` when no timezone is provided. Throws if the timezone is invalid.

Deprecated identifiers are resolved to the name the runtime supports, so `new DateTz(ts, 'US/Eastern')` and `DateTz.now('US/Eastern')` both report `America/New_York` and remain comparable.

### Supported range

`DateTz` models instants from **1970-01-01T00:00:00Z onwards**. Anything earlier — a negative timestamp, an `add`/`set` that lands before the epoch, or a local wall clock that falls before it in a negative-offset zone — throws rather than returning a nonsensical date.

---

## Instance Properties

Both properties are writable; assigning to either re-resolves `timezoneOffset` and `isDst` for the resulting instant.

| Property    | Type     | Description                                      |
| ----------- | -------- | ------------------------------------------------ |
| `timestamp` | `number` | Milliseconds since Unix epoch (UTC).             |
| `timezone`  | `string` | IANA timezone identifier (e.g. `Europe/Rome`).   |

---

## Getters

### Local (timezone-aware)

| Getter            | Type      | Description                                    |
| ----------------- | --------- | ---------------------------------------------- |
| `year`            | `number`  | Full year in the instance's timezone.          |
| `month`           | `number`  | Month index 0–11 in the instance's timezone.   |
| `day`             | `number`  | Day of month 1–31 in the instance's timezone.  |
| `hour`            | `number`  | Hour 0–23 in the instance's timezone.          |
| `minute`          | `number`  | Minute 0–59 in the instance's timezone.        |
| `second`          | `number`  | Second 0–59 in the instance's timezone.        |
| `millisecond`     | `number`  | Millisecond 0–999 in the instance's timezone.  |
| `dayOfWeek`       | `number`  | Day of week 0–6 (0 = Sunday) in the timezone.  |
| `timezoneOffset`  | `number`  | Current offset from UTC in **milliseconds**.   |
| `isDst`           | `boolean` | Whether the clock is ahead of the zone's standard offset. See [Timezone data](#timezone-data). |
| `isLeapYear`      | `boolean` | Whether the current year is a leap year.       |

### UTC equivalents

`yearUTC`, `monthUTC`, `dayUTC`, `hourUTC`, `minuteUTC`, `secondUTC`, `millisecondUTC`, `dayOfWeekUTC` — same semantics as above, but always in UTC.

---

## Methods

### `toString(pattern?: string, locale?: string): string`

Formats the date using the given pattern (defaults to `YYYY-MM-DD HH:mm:ss`).

**Format tokens**

`toString` and [`parse`](#datetzparsedatestring-string-pattern-string-tz-string-datetz) share one token vocabulary. The last column says what `parse` does with each token when it reads the string back.

| Token      | Output                             | Read back by `parse`            |
| ---------- | ---------------------------------- | ------------------------------- |
| `YYYY` `yyyy` | Full year (e.g. `2026`)         | yes                             |
| `YY` `yy`  | Last 2 digits of year              | yes, as 1970–2069               |
| `MM`       | Month 01–12                        | yes                             |
| `LM`       | Full month name (locale-aware)     | **no** — `parse` throws         |
| `SM`       | Short month name (locale-aware)    | **no** — `parse` throws         |
| `DD`       | Day 01–31                          | yes                             |
| `HH`       | Hour 00–23 (24h)                   | yes                             |
| `hh`       | Hour 01–12 (12h, pair with `aa`)   | yes                             |
| `mm`       | Minute 00–59                       | yes                             |
| `ss`       | Second 00–59                       | yes                             |
| `aa`       | am/pm                              | yes                             |
| `AA`       | AM/PM                              | yes                             |
| `WL`       | Full weekday name (locale-aware)   | matched, then ignored           |
| `WS`       | Short weekday name (locale-aware)  | matched, then ignored           |
| `tz`       | Timezone identifier string         | matched, then ignored           |

Month names are the one thing `parse` cannot read back: resolving them needs the locale they were written in, and `parse` takes no locale. It throws rather than guess at a language. Weekdays and zone identifiers are matched so the components after them stay aligned, but contribute nothing — a weekday is implied by the date, and the zone arrives as an argument.

Names follow the wall clock the instance resolved, so they always agree with the numeric tokens beside them — including under a custom [`TzProvider`](#tzprovider) that disagrees with the runtime.

---

### `add(value: number, unit): this`

Adds time to the instance in place. Accepts negative values.

**Units:** `millisecond` | `second` | `minute` | `hour` | `day` | `month` | `year`

The unit decides what "adding" means:

- **Time units** — `millisecond`, `second`, `minute`, `hour` — move the **instant**. An hour is always 3600 seconds, whatever the calendar does around it.
- **Calendar units** — `day`, `month`, `year` — move the **local wall clock**. Adding a day lands on the same clock time tomorrow, even when a DST transition makes that day 23 or 25 hours long.

```ts
const d = DateTz.parse('2025-03-29 12:00:00', 'YYYY-MM-DD HH:mm:ss', 'Europe/Rome');

d.add(1, 'day').toString();    // '2025-03-30 12:00:00'  — 23 real hours later
d.add(24, 'hour').toString();  // '2025-03-30 13:00:00'  — exactly 24 hours later
```

Adding months or years **clamps to the end of the target month** instead of spilling into the next one:

```ts
DateTz.parse('2026-01-31', 'YYYY-MM-DD').add(1, 'month').toString('YYYY-MM-DD');  // '2026-02-28'
DateTz.parse('2024-02-29', 'YYYY-MM-DD').add(1, 'year').toString('YYYY-MM-DD');   // '2025-02-28'
```

Day arithmetic still carries normally: `add(40, 'day')` crosses into the next month.

Landing on a wall clock a DST transition skipped or repeated resolves the same way [`parse`](#dst-transitions) does.

---

### `set(value: number, unit): this`

Sets a component of the **local wall clock** — the value a reader in that timezone would see.

**Units:** `year` | `month` | `day` | `hour` | `minute` | `second` | `millisecond`

```ts
const d = new DateTz(Date.UTC(2026, 6, 15, 22, 0, 0), 'Asia/Tokyo');  // 2026-07-16 07:00 local
d.set(9, 'hour').toString();   // '2026-07-16 09:00:00'
```

`month` is **1-based** here (pass `6` for June), unlike the zero-based `month` getter. A day the target month does not have is pulled back to the last one it does, matching `add`.

> **Changed in 1.x.** `add` and `set` used to operate on the UTC wall clock. `set(9, 'hour')` assigned 09:00 **UTC**, which for a zone far from UTC could move the local date to another day; `add(1, 'day')` added exactly 24 hours, shifting the local clock across a DST boundary. Both now work in the instance's own timezone. `stripSecMillis` likewise truncates the local clock.

---

### `stripSecMillis(): this`

Truncates seconds and milliseconds from the timestamp.

---

### `compare(other: IDateTz): number`

Returns the difference in timestamps (`this.timestamp - other.timestamp`). Throws if the two instances have different timezones.

### `isComparable(other: IDateTz): boolean`

Returns `true` if both instances share the same timezone.

---

## Timezone conversion

Both methods below preserve the absolute instant — only the display zone changes. The UTC timestamp is never altered.

### `cloneToTimezone(tz: string): DateTz`

Returns a **new** `DateTz` showing the same instant as experienced by a reader in `tz`. The original instance is not mutated.

**Use case:** a message saved with the sender's timezone should render to a reader as the wall-clock time they experienced.

```ts
// Message sent at 08:00 in Rome (CET, UTC+1)
const sent = DateTz.parse('2026-01-15 08:00:00', 'YYYY-MM-DD HH:mm:ss', 'Europe/Rome');

// What does the Tokyo reader (JST, UTC+9) see?
const forTokyo = sent.cloneToTimezone('Asia/Tokyo');
forTokyo.toString();   // '2026-01-15 16:00:00'
sent.toString();       // '2026-01-15 08:00:00'  ← original unchanged
```

Works correctly across DST transitions:

```ts
// 08:00 CEST on a summer day is UTC+2 → Tokyo sees 15:00
const summer = DateTz.parse('2026-07-15 08:00:00', 'YYYY-MM-DD HH:mm:ss', 'Europe/Rome');
summer.cloneToTimezone('Asia/Tokyo').toString(); // '2026-07-15 15:00:00'
```

---

### `setTimezone(tz: string): this`

Changes the display zone **in place**, recomputing offset and DST. Equivalent to assigning to `timezone`.

---

## Static Methods

### `DateTz.parse(dateString: string, pattern?: string, tz?: string): DateTz`

Parses a string to a `DateTz` instance. Pattern defaults to `YYYY-MM-DD HH:mm:ss`, timezone defaults to `Etc/UTC`. When using 12-hour format (`hh`) the pattern must also include `aa` or `AA`.

```ts
const d = DateTz.parse('2025-11-06 11:05:00 PM', 'YYYY-MM-DD hh:mm:ss AA', 'America/New_York');
```

The string must match the pattern from its first character on: separators are compared literally and numeric components must carry their padding. A string that does not fit throws, naming the pattern it failed against.

```ts
DateTz.parse('2026-06-22', 'YYYY/MM/DD');   // throws: does not match pattern "YYYY/MM/DD"
DateTz.parse('26-6-2', 'YYYY-MM-DD');       // throws: unpadded components
DateTz.parse('2026-08-13T13:45', 'YYYY-MM-DD HH:mm:ss');  // throws: no seconds to read
```

The pattern states what to **read**, not everything the string is allowed to carry, so anything past the last token is ignored. That is what lets an ISO 8601 value parse against a pattern that stops at the second:

```ts
DateTz.parse('2026-08-13T13:45:30.123Z', 'YYYY-MM-DD HH:mm:ss');      // 2026-08-13 13:45:30
DateTz.parse('2026-08-13T13:45:30+02:00', 'YYYY-MM-DD HH:mm:ss');     // 2026-08-13 13:45:30
DateTz.parse('2026-08-13T13:45', 'YYYY-MM-DD');                        // 2026-08-13 00:00:00
```

A zone suffix is **skipped, not honoured**: the resulting instant is the wall clock read in the timezone passed to `parse`, exactly as the `tz` token behaves. Pass the offset's zone as the third argument if you need it respected.

**One exception:** the break between date and time is `T` in ISO 8601 and a space in RFC 3339 §5.6, which are the same separator written two ways. A pattern using either accepts both, so the value an HTML `datetime-local` input produces parses against the pattern you would naturally write:

```ts
DateTz.parse('2026-08-13T13:45', 'YYYY-MM-DD HH:mm');   // ok
DateTz.parse('2026-08-13 13:45', 'YYYY-MM-DDTHH:mm');   // ok
DateTz.parse('2026-08-13X13:45', 'YYYY-MM-DD HH:mm');   // throws — only T and space
```

A `T` inside a longer literal (`GMT`) stays part of that text.

Components the pattern omits fall back to their floor — year `1970`, month and day `01`, everything else `0` — so a partial pattern parses rather than failing.

> **Changed in 1.x.** `parse` used to read each component at the offset its token sat at in the pattern, which held only while every token was exactly as wide as the text it produced. A variable-width name shifted everything after it, and mismatched input yielded a wrong date instead of an error. Three consequences are gone: `yyyy` always produced the year 1970, `YY` and `yy` were not recognised at all, and a pattern containing `LM`, `SM`, `WS`, `WL` or `tz` misread every component that followed. Input whose separators or padding disagree with the pattern now throws instead of returning wrong data. Text past the last token is still ignored, as before.

#### DST transitions

A DST transition can leave a wall-clock time **ambiguous** (it happens twice, when clocks go back) or **non-existent** (it is skipped, when clocks go forward). Both resolve with the offset in effect *before* the transition — the same convention as Temporal's `compatible` disambiguation, Luxon and `java.time`. The rule holds in every zone, whichever side of UTC it sits on.

```ts
// Skipped: 02:30 does not exist, so it shifts forward by the size of the gap
DateTz.parse('2025-03-30 02:30:00', 'YYYY-MM-DD HH:mm:ss', 'Europe/Rome').toString();
// '2025-03-30 03:30:00'
DateTz.parse('2025-03-09 02:30:00', 'YYYY-MM-DD HH:mm:ss', 'America/New_York').toString();
// '2025-03-09 03:30:00'

// Ambiguous: 02:30 happens twice, and the first occurrence wins
const first = DateTz.parse('2025-10-26 02:30:00', 'YYYY-MM-DD HH:mm:ss', 'Europe/Rome');
first.isDst;       // true  — 02:30 CEST, not the later 02:30 CET
first.toString();  // '2025-10-26 02:30:00'
```

### `DateTz.now(tz?: string): DateTz`

Returns the current instant as a `DateTz` in the given timezone (default `Etc/UTC`).

### `DateTz.timezones(): string[]`

Returns all recognised timezone identifiers, including deprecated aliases.

### `DateTz.supportedTimeZones(): string[]`

Returns the canonical IANA timezone identifiers supported by the runtime.

---

## Static Properties

| Property              | Default                   |
| --------------------- | ------------------------- |
| `DateTz.defaultFormat` | `'YYYY-MM-DD HH:mm:ss'`  |

---

## Serialisation

Instances carry their state in ECMAScript private fields, so nothing leaks into the wire format under an internal name. `JSON.stringify` uses `toJSON()`, which emits exactly what the constructor reads back:

```ts
const d = new DateTz(1786621500000, 'Europe/Rome');

JSON.stringify(d);
// {"timestamp":1786621500000,"timezone":"Europe/Rome"}

const back = new DateTz(JSON.parse(JSON.stringify(d)));
back.toString();   // '2026-08-13 13:45:00'
```

This holds when instances are nested inside a larger payload, which is the usual case for a message queue or an HTTP body:

```ts
JSON.stringify({ bookingId: 42, start: d });
// {"bookingId":42,"start":{"timestamp":1786621500000,"timezone":"Europe/Rome"}}
```

`timezoneOffset` and `isDst` are deliberately **not** serialised. They are derived from the instant and the zone, and the receiving side resolves them against its own [timezone data](#timezone-data) rather than trusting numbers computed elsewhere, possibly by a runtime with an older copy of the database.

> **Transports that bypass `toJSON`.** `structuredClone`, object spread and `Object.assign` copy enumerable own properties and do not consult `toJSON`, so they see an empty object. Call `date.toJSON()` explicitly when the value crosses one of those.

> **Fixed in 1.x.** Two state fields were briefly declared as TypeScript `private`, which is erased at compile time: the properties stayed enumerable at runtime under `_timestamp` and `_timezone`, so a serialised instance no longer had the names the constructor reads and rebuilding one threw `Invalid timestamp: undefined`.

---

## Timezone data

UTC offsets come from **the runtime's own copy of the IANA timezone database**, read through `Intl`. The library ships no zone data of its own, which keeps it dependency-free and as current as the host — but it also means the answer depends on the host, not on the version of this package.

Check what a runtime carries:

```bash
node -p "process.versions.tz"
```

When a country changes its rules, an outdated runtime keeps returning the old offset for dates after the change, and there is nothing this package can do about it from the outside. That is what the provider below is for.

### How `isDst` is decided

`isDst` is true when the instant's offset is **ahead of the zone's standard offset**, taken as the lowest offset the zone observes across the calendar year. It is not read from the zone's display name: `Intl` renders several zones as a bare `GMT+01:00` with no name to match on, and names are locale-dependent besides.

Two consequences worth knowing:

- **Europe/Dublin** models winter as *negative* DST off a standard of UTC+1, so IANA would call January its DST period. This library reports summer instead — the question users actually mean.
- **Africa/Casablanca** ran on UTC+1 year-round with a pause at UTC+0 for Ramadan, so before 2026-09-20 the pause reads as standard time and the rest of the year as DST.

### `TzProvider`

Every offset lookup goes through a single provider, so the zone rules can be replaced wholesale:

```ts
import { setTzProvider, intlTzProvider, TzProvider } from '@open-rlb/date-tz';

const pinned: TzProvider = {
  offsetAt: (timestamp, timezone) => timezone === 'Europe/Rome'
    ? { offset: 60, isDst: false }        // offset in minutes east of UTC
    : intlTzProvider.offsetAt(timestamp, timezone),
};

setTzProvider(pinned);
setTzProvider(null);   // restore the runtime's rules
```

Install a provider **before** constructing dates: an instance resolves its offset on construction and does not revisit it.

### Morocco's move to permanent UTC+0

Morocco abolished daylight saving time on **2026-09-20 at 02:00 local**, settling on permanent UTC+0 and dropping the Ramadan pause. The change applies to `Africa/Casablanca` and `Africa/El_Aaiun` (Western Sahara). Announcements citing 21 September refer to the first full day on the new offset.

Runtimes shipping a timezone database older than that release still resolve Moroccan dates after the transition to UTC+1. `installMoroccoOverride()` corrects them:

```ts
import { installMoroccoOverride, runtimeKnowsMoroccoChange } from '@open-rlb/date-tz';

installMoroccoOverride();   // true if the correction was needed and applied
```

It is **self-cancelling**: on a runtime that already carries the rule it installs nothing and returns `false`, so it never fights a database that has since learned the real rule. Calling it more than once is safe. Use `runtimeKnowsMoroccoChange()` to inspect the runtime directly.

---

## Error handling

| Situation                                       | Behaviour        |
| ----------------------------------------------- | ---------------- |
| Invalid or unknown timezone                     | Throws `Error`   |
| Comparing two instances with different timezones | Throws `Error`  |
| 12-hour pattern (`hh`) without `aa`/`AA`        | Throws `Error`   |
| Instant before 1970-01-01, in UTC or local time | Throws `Error`   |
| Non-finite `timestamp`, or non-finite `add` amount | Throws `Error` |
| Ambiguous or skipped wall clock at a DST transition | Resolved with the pre-transition offset (see above) |

---

## Full example

```ts
import { DateTz } from '@open-rlb/date-tz';

// Construct from a raw timestamp
const event = new DateTz(1742053200000, 'Asia/Dubai');
event.toString(); // '2025-03-15 19:40:00'

// Parse from a formatted string
const meeting = DateTz.parse('2025-06-15 10:20:30', 'YYYY-MM-DD HH:mm:ss', 'Europe/Berlin');
meeting.toString('WL DD LM YYYY HH:mm', 'en'); // 'Sunday 15 June 2025 10:20'

// Manipulate
meeting.add(2, 'hour').add(30, 'minute');
meeting.toString(); // '2025-06-15 12:50:30'

// Cross-timezone read — sender in Rome, reader in Tokyo
const msg = DateTz.parse('2026-01-15 08:00:00', 'YYYY-MM-DD HH:mm:ss', 'Europe/Rome');
msg.cloneToTimezone('Asia/Tokyo').toString(); // '2026-01-15 16:00:00'

// Current time in Los Angeles
const now = DateTz.now('America/Los_Angeles');
console.log(now.toString());
```
