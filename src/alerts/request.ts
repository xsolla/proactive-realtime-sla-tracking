export function parseAlertRunRequest(body: string): { dryRun: boolean } | { error: string } {
  if (body.trim() === "") {
    return { dryRun: false };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { error: "Request body must be JSON." };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { error: "Request body must be a JSON object." };
  }
  if (!("dryRun" in parsed)) {
    return { dryRun: false };
  }
  if (typeof parsed.dryRun !== "boolean") {
    return { error: "dryRun must be a boolean." };
  }
  return { dryRun: parsed.dryRun };
}
