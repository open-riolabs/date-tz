import { TzInfo, TzProvider } from "./interfaces";
import { getTzProvider, intlOffsetMinutes, setTzProvider } from "./tz-provider";

/**
 * Morocco abolished daylight saving time, moving to permanent UTC+0. The
 * zones affected are the country itself and Western Sahara, which has always
 * followed Moroccan clocks.
 */
const MOROCCO_ZONES = new Set(['Africa/Casablanca', 'Africa/El_Aaiun']);

/**
 * The final Moroccan transition: 2026-09-20 at 02:00 local time. The clock
 * ran on UTC+1 up to that point, which places the instant at 01:00 UTC.
 * Announcements citing the 21st refer to the first full day on the new
 * offset, not to the transition itself.
 */
export const MOROCCO_PERMANENT_UTC_FROM = Date.UTC(2026, 8, 20, 1, 0, 0);

/**
 * An instant comfortably past the transition, and past any Ramadan pause the
 * old rules would have scheduled near it. A runtime that reports UTC+0 here
 * has the new rule; one that reports UTC+1 is still on pre-change data.
 */
const PROBE_INSTANT = Date.UTC(2026, 11, 1, 12, 0, 0);

/**
 * Whether the runtime's timezone database already carries Morocco's move to
 * permanent UTC+0.
 *
 * The offset is read straight from `Intl` rather than through the active
 * provider: the point is to find out what the runtime believes, which is
 * precisely what an installed override would be hiding.
 *
 * @returns True when the runtime resolves Morocco to UTC+0 after the change.
 */
export function runtimeKnowsMoroccoChange(): boolean {
  try {
    return intlOffsetMinutes(PROBE_INSTANT, 'Africa/Casablanca') === 0;
  } catch {
    // A runtime that cannot resolve the zone at all is in no position to know.
    return false;
  }
}

/** Providers this module produced, so wrapping one twice is a no-op. */
const wrapped = new WeakSet<TzProvider>();

/**
 * Wraps a provider so Moroccan zones resolve to UTC+0 from the 2026-09-20
 * transition onwards, covering the gap between the rule being announced and
 * the host's timezone database catching up.
 *
 * The wrapper is self-cancelling: when the runtime already knows the new
 * rule, the base provider is returned untouched. That keeps the correction
 * from outliving its purpose and, more importantly, from fighting a runtime
 * that has since learned the real rule — including any refinement to it that
 * this hard-coded cutoff would otherwise paper over. Wrapping an already
 * wrapped provider is likewise a no-op.
 *
 * @param base - The provider to wrap. Defaults to the installed one.
 * @returns The wrapped provider, or `base` when the correction is redundant.
 */
export function withMoroccoOverride(base: TzProvider = getTzProvider()): TzProvider {
  if (wrapped.has(base) || runtimeKnowsMoroccoChange()) return base;

  const provider: TzProvider = {
    offsetAt(timestamp: number, timezone: string): TzInfo {
      if (timestamp >= MOROCCO_PERMANENT_UTC_FROM && MOROCCO_ZONES.has(timezone)) {
        // Permanent standard time: no offset, and nothing left to call DST.
        return { offset: 0, isDst: false };
      }
      return base.offsetAt(timestamp, timezone);
    },
  };

  wrapped.add(provider);
  return provider;
}

/**
 * Installs {@link withMoroccoOverride} over the active provider.
 *
 * Call it at startup, before constructing any date: instances resolve their
 * offset on construction and will not revisit it. Calling it again is safe
 * and does nothing.
 *
 * @returns True when the correction was installed, false when it was already
 * in place or the runtime already knew the rule.
 */
export function installMoroccoOverride(): boolean {
  const base = getTzProvider();
  const provider = withMoroccoOverride(base);
  if (provider === base) return false;

  setTzProvider(provider);
  return true;
}
