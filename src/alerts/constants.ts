/**
 * Provisional thresholds for the tracking-only heads-up.
 * Not agreed policy. Without both gates, a zero median turns every incident
 * into an alert.
 */
export const HEADS_UP_MIN_MINUTES = 30;

/** Current minutes must be at least this multiple of the prior-month median. */
export const HEADS_UP_MEDIAN_RATIO = 2;

/** Current minutes must exceed the median by at least this many minutes. */
export const HEADS_UP_MEDIAN_MARGIN_MINUTES = 15;
