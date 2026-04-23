# DateTz Playground

A single-page web app — inspired by [epochconverter.com/timezones](https://www.epochconverter.com/timezones) — for exercising every public surface of `DateTz` in the browser.

**Live:** https://open-riolabs.github.io/date-tz/

## Run

```bash
npm run webapp:build   # compiles src/*.ts → webapp/lib/*.js (ES modules)
npm run webapp:serve   # starts http://localhost:5173
```

Re-run `webapp:build` whenever the `DateTz` sources change.

## What it covers

- **World Clock** — live local time in a grid of IANA cities (`DateTz.now`, `.toString`, `.isDst`, `.timezoneOffset`).
- **Timestamp → DateTz** — `new DateTz(ms, tz)` with every getter rendered.
- **Parse string → DateTz** — `DateTz.parse(str, pattern, tz)`.
- **Format DateTz → string** — `date.toString(pattern, locale)` with a token reference.
- **Cross-timezone view** — one instant seen through `cloneToTimezone` across multiple zones.
- **Manipulate** — chain `add`, `set`, `stripSecMillis`, `setTimezone`, `cloneToTimezone` with a history log.

## Structure

```
webapp/
├── index.html            ← layout
├── styles.css            ← dark theme
├── app.js                ← UI logic, imports ./lib/index.js
├── build.mjs             ← tsc + rewrite relative imports to add .js
├── serve.mjs             ← zero-dependency static server
├── tsconfig.webapp.json  ← ES-module output for the browser
└── lib/                  ← generated — do not edit
```

The build step runs `tsc` against `src/*.ts` with `module: es2022` and post-processes the output so that relative imports end in `.js` — browsers require explicit extensions for native ES modules.

## Deploy to GitHub Pages

The workflow [`.github/workflows/pages.yaml`](../.github/workflows/pages.yaml) builds and deploys the playground on every push to `master` that touches `src/`, `webapp/`, or the workflow itself.

First-time setup (one-off, on GitHub):

1. Open **Settings → Pages**.
2. Under **Source**, choose **GitHub Actions**.

Next push to `master` publishes the site at the URL above.
