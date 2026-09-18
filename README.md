# DateTz

A lightweight TypeScript date-time utility with full timezone support, custom formatting, parsing, and manipulation — built on the `Intl` API with no external dependencies.

---

## Installation

```ts
import { DateTz } from '@open-rlb/date-tz';
```

### Entry points

The root entry point re-exports everything you normally need, and is the one to prefer:

```ts
import { DateTz, IDateTz, getTzProvider, setTzProvider } from '@open-rlb/date-tz';
```

Single modules stay reachable as subpaths, with or without the `.js` extension — both forms
resolve under Node's ESM loader as well as under a bundler:

```ts
import { DateTz } from '@open-rlb/date-tz/date-tz';     // '.../date-tz.js' works too
```

Available subpaths: `date-tz`, `interfaces`, `tz-provider`, `tz-exceptions`, `tz-overrides`,
`canonical-link`, `helpers`.

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

Four plain public fields. They are what an instance serialises to; see [Serialisation](#serialisation).

| Property         | Type      | Description                                      |
| ---------------- | --------- | ------------------------------------------------ |
| `timestamp`      | `number`  | Milliseconds since Unix epoch (UTC).             |
| `timezone`       | `string`  | IANA timezone identifier (e.g. `Europe/Rome`).   |
| `timezoneOffset` | `number`  | Current offset from UTC in **milliseconds**.     |
| `isDst`          | `boolean` | Whether the clock is ahead of the zone's standard offset. See [Timezone data](#timezone-data). |

Assigning to `timestamp` or `timezone` directly does not recompute `timezoneOffset` and `isDst`, and does not normalise the zone identifier. Change the zone with [`setTimezone`](#settimezonetz-string-this) and move the instant with `add` or `set`: those keep all four fields in step.

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

Changes the display zone **in place**, normalising the identifier and recomputing offset and DST. Assigning to `timezone` directly does neither.

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

An instance serialises as its four public fields, whatever copies it: `JSON.stringify`, a database driver, `structuredClone` or object spread.

```ts
const d = new DateTz(1786621500000, 'Europe/Rome');

JSON.stringify(d);
// {"timestamp":1786621500000,"timezone":"Europe/Rome","timezoneOffset":7200000,"isDst":true}

const back = new DateTz(JSON.parse(JSON.stringify(d)));
back.toString();   // '2026-08-13 13:45:00'
```

This holds when instances are nested inside a larger payload, which is the usual case for a message queue or an HTTP body:

```ts
JSON.stringify({ bookingId: 42, start: d });
// {"bookingId":42,"start":{"timestamp":1786621500000,"timezone":"Europe/Rome","timezoneOffset":7200000,"isDst":true}}
```

The constructor reads back only `timestamp` and `timezone`. `timezoneOffset` and `isDst` are resolved again against the receiving runtime's own [timezone data](#timezone-data), so a payload computed elsewhere, possibly by a runtime with an older copy of the database, cannot carry a stale offset into a new instance.

> **Changed in the release after 3.0.1.** The fields were hidden in two earlier releases, and serialisation broke both times. In 2.1.5–2.1.7 they were TypeScript `private` fields named `_timestamp` and `_timezone`, so rebuilding an instance threw `Invalid timestamp: undefined`. In 2.1.8–3.0.1 they were ECMAScript private fields behind a `toJSON()` that emitted only `timestamp` and `timezone`, so database drivers, `structuredClone` and object spread, which do not call `toJSON`, saw an empty object. They are public fields again, and `toJSON()` has been removed.

---

## Timezone data

UTC offsets come from **the runtime's own copy of the IANA timezone database**, read through `Intl`. The library ships no zone data of its own, which keeps it dependency-free and as current as the host — but it also means the answer depends on the host, not on the version of this package.

Check what a runtime carries:

```bash
node -p "process.versions.tz"
```

When a country changes its rules, an outdated runtime keeps returning the old offset for dates after the change. Nothing this package does can update the runtime's database: a new one arrives only with a Node release, a browser update or an operating system image, often months after the change takes effect. [Timezone exceptions](#timezone-exceptions) close that gap by stating the new rule directly, and a [provider](#tzprovider) replaces the rules wholesale.

### How `isDst` is decided

`isDst` is true when the instant's offset is **ahead of the zone's standard offset**, taken as the lowest offset the zone observes across the calendar year. It is not read from the zone's display name: `Intl` renders several zones as a bare `GMT+01:00` with no name to match on, and names are locale-dependent besides.

Two consequences worth knowing:

- **Europe/Dublin** models winter as *negative* DST off a standard of UTC+1, so IANA would call January its DST period. This library reports summer instead — the question users actually mean.
- **Africa/Casablanca** ran on UTC+1 year-round with a pause at UTC+0 for Ramadan, so before 2026-09-20 the pause reads as standard time and the rest of the year as DST.

For the instants a [timezone exception](#timezone-exceptions) covers, `isDst` is whatever the exception states, not the calculation above.

### Timezone exceptions

`TzExceptions` is a static registry of rule changes the runtime may not know yet. The default provider consults it **before** the runtime, so every date — constructed, parsed, or moved by `add` and `set` — follows a registered exception without any other call.

#### Preloaded exceptions

| Zone                | From (UTC)             | At the change, local time                  | Offset | `isDst` | Source       |
| ------------------- | ---------------------- | ------------------------------------------ | ------ | ------- | ------------ |
| `Africa/Casablanca` | `2026-09-20T01:00:00Z` | 02:00 on UTC+1; clocks go back to 01:00    | UTC+0  | `false` | tzdata 2026c |
| `Africa/El_Aaiun`   | `2026-09-20T01:00:00Z` | as in Morocco (Western Sahara)             | UTC+0  | `false` | tzdata 2026c |
| `America/Vancouver` | `2026-11-01T09:00:00Z` | 02:00 on UTC-7; clocks no longer fall back | UTC-7  | `false` | tzdata 2026b |

**Morocco** abolished daylight saving time, settling on permanent UTC+0 and dropping the Ramadan pause. Announcements citing 21 September refer to the first full day on the new offset.

**British Columbia** made its 2026-03-08 spring forward the last clock change and stays on UTC-7 year-round. The change legally took effect on 2026-03-09; like tzdata, the exception starts on 2026-11-01 at 02:00, the first instant at which the clock would otherwise have differed. From then on UTC-7 is the zone's **standard** time — tzdata abbreviates it `MST` — so `isDst` is `false`, including for the rest of 2026, where the yearly calculation would still see January's UTC-8.

The exceptions apply whether or not the runtime already carries the rule; where it does, the two agree.

#### Registering an exception

Register exceptions where the application starts, **before** creating dates: an instance resolves its offset when its instant or zone changes, and does not revisit it otherwise.

```ts
import { DateTz, TzExceptions } from '@open-rlb/date-tz';

TzExceptions.register({
  timezone: 'America/Edmonton',
  from: DateTz.parse('2026-11-01 08:00:00', 'YYYY-MM-DD HH:mm:ss', 'Etc/UTC').timestamp,
  offset: -360,   // minutes east of UTC, signed
  isDst: false,
  description: 'Alberta: permanent UTC-6 (tzdata 2026c)',
});

console.log(`${TzExceptions}`);
```

```text
TzExceptions: 4 exceptions registered
  Africa/Casablanca  [2026-09-20T01:00:00Z, +inf)  UTC+00:00  standard  Morocco abolishes DST: permanent UTC+0 (tzdata 2026c)
  Africa/El_Aaiun    [2026-09-20T01:00:00Z, +inf)  UTC+00:00  standard  Western Sahara follows Moroccan clocks: permanent UTC+0 (tzdata 2026c)
  America/Edmonton   [2026-11-01T08:00:00Z, +inf)  UTC-06:00  standard  Alberta: permanent UTC-6 (tzdata 2026c)
  America/Vancouver  [2026-11-01T09:00:00Z, +inf)  UTC-07:00  standard  British Columbia stops changing clocks: permanent UTC-7 (tzdata 2026b)
```

Ranges read as intervals: `[` includes its bound, `)` excludes it, and instants are in UTC.

| Field         | Type      | Meaning |
| ------------- | --------- | ------- |
| `timezone`    | `string`  | IANA identifier. Aliases resolve as `DateTz` resolves them, so `Canada/Pacific` covers `America/Vancouver`. |
| `from`        | `number?` | First instant covered, in ms since the epoch, **inclusive**. Omit it for no start. |
| `to`          | `number?` | First instant no longer covered, in ms since the epoch, **exclusive**. Omit it for no end. |
| `offset`      | `number`  | Minutes east of UTC, **signed**: `-420` is UTC-7, `330` is UTC+5:30. It replaces the runtime's offset rather than adjusting it. |
| `isDst`       | `boolean` | Summer time (`true`) or standard time (`false`). |
| `description` | `string?` | A label, printed by `toString()`. |

State bounds in UTC, as above: a local wall clock at the moment of a transition is ambiguous by nature.

| Method | Description |
| ------ | ----------- |
| `register(exception): boolean` | Adds an exception. Returns `false`, changing nothing, when an identical one is already registered. |
| `unregister(timezone): boolean` | Removes every exception for a zone, preloaded ones included. Returns `false` when there were none. |
| `clear(): void` | Removes every exception, preloaded ones included. |
| `reset(): void` | Restores the preloaded exceptions, dropping everything else. |
| `find(timestamp, timezone): TzException \| undefined` | The exception covering an instant, matched against the identifier a `DateTz` reports. |
| `list(): TzException[]` | Every exception, sorted by zone and start. Entries are frozen. |
| `toString(): string` | One line per exception, for debugging. `String(TzExceptions)` prints the same. |

Exceptions for the same zone **may not overlap**, so what the registry answers never depends on the order of registration. To replace one, preloaded ones included, unregister its zone and register the new rule:

```ts
// Hand British Columbia back to the runtime once every host runs tzdata 2026b or later.
TzExceptions.unregister('America/Vancouver');
```

The registry lives inside the default provider, `intlTzProvider`. A custom provider that delegates to it, like the one below, inherits the exceptions; one that answers on its own replaces them along with the runtime's rules.

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

### `installMoroccoOverride()` (deprecated)

Before timezone exceptions existed, Morocco's change was corrected by installing a provider: `installMoroccoOverride()` wrapped the active one on a runtime that did not know the rule, and `withMoroccoOverride()` built the wrapper. Both still work, and are safe to call, but the preloaded exception already applies the rule, so there is nothing left to install. `runtimeKnowsMoroccoChange()` still reports whether the runtime itself carries the rule.

> **Changed in 1.x.** Dates in `Africa/Casablanca` and `Africa/El_Aaiun` from 2026-09-20, and in `America/Vancouver` from 2026-11-01, follow the new rules by default, whatever timezone database the host ships. `installMoroccoOverride()` and `withMoroccoOverride()` are deprecated.

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
| `TzExceptions.register` with an unknown zone, an invalid offset, bound, `isDst` or description, or `from` not before `to` | Throws `Error` |
| `TzExceptions.register` overlapping an exception for the same zone | Throws `Error`; an identical one returns `false` |

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
