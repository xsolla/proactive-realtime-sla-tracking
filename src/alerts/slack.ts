const SLACK_POST_MESSAGE = "https://slack.com/api/chat.postMessage";
const REQUEST_TIMEOUT_MS = 10_000;
const RETRY_AFTER_CAP_MS = 2_000;
const DEFAULT_RETRY_AFTER_MS = 1_000;

export type SlackPostResult = { ok: true } | { ok: false; error: string };

type Attempt =
  | { kind: "delivered" }
  | { kind: "rejected"; error: string }
  | { kind: "rate_limited"; waitMs: number };

/**
 * Slack returns HTTP 200 for a failed chat.postMessage. Delivery is ok: true
 * in the body. Anything else, including a timeout, is not delivered.
 */
export async function postSlackMessage(input: {
  token: string;
  channel: string;
  text: string;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}): Promise<SlackPostResult> {
  const doFetch = input.fetch ?? fetch;
  const sleep = input.sleep ?? defaultSleep;
  const now = input.now ?? Date.now;

  const first = await attempt(doFetch, input, now);
  if (first.kind !== "rate_limited") {
    return finish(first);
  }
  await sleep(first.waitMs);
  const second = await attempt(doFetch, input, now);
  if (second.kind === "rate_limited") {
    return { ok: false, error: "Slack rate limited the send (HTTP 429) after one retry." };
  }
  return finish(second);
}

async function attempt(
  doFetch: typeof fetch,
  input: { token: string; channel: string; text: string },
  now: () => number,
): Promise<Attempt> {
  const controller = new AbortController();
  const timeout = new Error("Slack request timed out");
  timeout.name = "TimeoutError";
  const timer = setTimeout(() => controller.abort(timeout), REQUEST_TIMEOUT_MS);
  timer.unref?.();
  try {
    const response = await doFetch(SLACK_POST_MESSAGE, {
      method: "POST",
      cache: "no-store",
      headers: {
        authorization: `Bearer ${input.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ channel: input.channel, text: input.text }),
      signal: controller.signal,
    });
    if (response.status === 429) {
      return {
        kind: "rate_limited",
        waitMs: Math.min(retryAfterMs(response.headers.get("retry-after"), now()), RETRY_AFTER_CAP_MS),
      };
    }
    return classify(response);
  } catch (error) {
    return { kind: "rejected", error: describeFetchError(error) };
  } finally {
    clearTimeout(timer);
  }
}

async function classify(response: Response): Promise<Attempt> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (response.ok && isRecord(payload) && payload.ok === true) {
    return { kind: "delivered" };
  }
  if (isRecord(payload) && payload.ok === false) {
    const error = typeof payload.error === "string" && payload.error.trim() !== "" ? payload.error : "ok: false";
    return { kind: "rejected", error: explainSlackError(error) };
  }
  return { kind: "rejected", error: `Slack returned HTTP ${response.status} without ok: true.` };
}

function finish(attemptResult: Attempt): SlackPostResult {
  if (attemptResult.kind === "delivered") {
    return { ok: true };
  }
  if (attemptResult.kind === "rejected") {
    return { ok: false, error: attemptResult.error };
  }
  return { ok: false, error: "Slack rate limited the send (HTTP 429) after one retry." };
}

function explainSlackError(error: string): string {
  if (error === "not_in_channel") {
    return "not_in_channel: the bot is not a member of this channel. Invite it, then the next run will retry. The bot needs the chat:write scope.";
  }
  if (error === "channel_not_found") {
    return "channel_not_found: Slack has no channel with this id.";
  }
  if (error === "invalid_auth") {
    return "invalid_auth: Slack rejected SLACK_BOT_TOKEN. The bot needs the chat:write scope.";
  }
  return error;
}

function describeFetchError(error: unknown): string {
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return "Slack request timed out before delivery could be confirmed.";
  }
  return "Slack request failed before delivery could be confirmed.";
}

function retryAfterMs(header: string | null, now: number): number {
  if (header === null || header.trim() === "") {
    return DEFAULT_RETRY_AFTER_MS;
  }
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }
  const when = Date.parse(header);
  if (Number.isFinite(when)) {
    return Math.max(0, when - now);
  }
  return DEFAULT_RETRY_AFTER_MS;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
