/**
 * Provisional engineering estimates pending calibration against historical
 * replay, not agreed policy. Calibrate against GTOC-42 before enabling alerts.
 */
export const MIN_ELAPSED = 0.2;
export const MIN_CONSUMPTION = 0.1;
export const HIGH_CONSUMPTION = 0.75;

/** Measurement timezone. Never taken from the host or the viewer. */
export const WINDOW_TIMEZONE = "UTC";
