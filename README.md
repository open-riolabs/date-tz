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
| `dayOfWeek`       | `number`  | Day of week 0–6 (0 = Sunday) in the timezone.  |
| `timezoneOffset`  | `number`  | Current offset from UTC in **milliseconds**.   |
| `isDst`           | `boolean` | Whether DST is active at this instant.         |
| `isLeapYear`      | `boolean` | Whether the current year is a leap year.       |

### UTC equivalents

`yearUTC`, `monthUTC`, `dayUTC`, `hourUTC`, `minuteUTC`, `dayOfWeekUTC` — same semantics as above, but always in UTC.

---

## Methods

### `toString(pattern?: string, locale?: string): string`

Formats the date using the given pattern (defaults to `YYYY-MM-DD HH:mm:ss`).

**Format tokens**

| Token      | Output                             |
| ---------- | ---------------------------------- |
| `YYYY` `yyyy` | Full year (e.g. `2026`)         |
| `YY` `yy`  | Last 2 digits of year              |
| `MM`       | Month 01–12                        |
| `LM`       | Full month name (locale-aware)     |
| `SM`       | Short month name (locale-aware)    |
| `DD`       | Day 01–31                          |
| `HH`       | Hour 00–23 (24h)                   |
| `hh`       | Hour 01–12 (12h, pair with `aa`)   |
| `mm`       | Minute 00–59                       |
| `ss`       | Second 00–59                       |
| `aa`       | am/pm                              |
| `AA`       | AM/PM                              |
| `WL`       | Full weekday name (locale-aware)   |
| `WS`       | Short weekday name (locale-aware)  |
| `tz`       | Timezone identifier string         |

---

### `add(value: number, unit): this`

Adds time to the instance in place. Normalises overflow (minutes → hours → days, etc.).

**Units:** `millisecond` | `second` | `minute` | `hour` | `day` | `month` | `year`

---

### `set(value: number, unit): this`

Sets a specific date/time component.

**Units:** `year` | `month` | `day` | `hour` | `minute` | `second` | `millisecond`

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
