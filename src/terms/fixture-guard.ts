/**
 * Runs when this module is evaluated. The check is import-time: `listScopes`
 * is never reached when NODE_ENV is production, because the module does not finish loading.
 */
const nodeEnv = process.env["NODE_ENV"];

if (nodeEnv === "production") {
  throw new Error(
    "FixtureTermsProvider cannot be loaded when NODE_ENV is production. It is for engine tests only and must never be wired to a route or a page.",
  );
}
