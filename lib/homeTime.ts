// The recorded home is in Japan; sighting times are UTC ISO strings, shown in the home's own time.
export const HOME_TZ = "Asia/Tokyo";

/** "07:41" (or "07:41:11" with seconds) in the home's time zone. */
export function homeClock(iso: string, seconds = false): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", ...(seconds && { second: "2-digit" }), timeZone: HOME_TZ, hourCycle: "h23" });
}
