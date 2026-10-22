import { Client } from "pg";
import { describe, expect, it } from "vitest";
import { connectionOptions } from "@/data";

const URL_WITH_SSLMODE = "postgres://app:secret@db.internal:5432/sla?sslmode=require&application_name=sla";
const CA = "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----";

/** The TLS settings pg actually uses once URL parameters are merged over the options. */
function effectiveSsl(options: ReturnType<typeof connectionOptions>) {
  return (new Client(options) as unknown as { ssl: unknown }).ssl;
}

describe("connectionOptions", () => {
  it("passes the connection string through when no server CA is configured", () => {
    expect(connectionOptions(URL_WITH_SSLMODE, undefined)).toEqual({ connectionString: URL_WITH_SSLMODE });
    expect(connectionOptions(URL_WITH_SSLMODE, "  ")).toEqual({ connectionString: URL_WITH_SSLMODE });
  });

  it("verifies against the configured CA and drops the URL's TLS parameters", () => {
    const options = connectionOptions(`${URL_WITH_SSLMODE}&uselibpqcompat=true&sslrootcert=/x.pem`, CA);

    expect(options.connectionString).toBe("postgres://app:secret@db.internal:5432/sla?application_name=sla");
    expect(effectiveSsl(options)).toMatchObject({ ca: CA });
    expect(effectiveSsl(options)).not.toHaveProperty("rejectUnauthorized", false);
  });

  it("skips the hostname check, since the instance certificate does not name the PSC host", () => {
    const ssl = effectiveSsl(connectionOptions(URL_WITH_SSLMODE, CA)) as {
      checkServerIdentity: (host: string, cert: object) => Error | undefined;
    };

    expect(ssl.checkServerIdentity("db.internal", {})).toBeUndefined();
  });

  it("accepts a PEM whose newlines arrive escaped", () => {
    const options = connectionOptions(URL_WITH_SSLMODE, CA.replaceAll("\n", "\\n"));

    expect(effectiveSsl(options)).toMatchObject({ ca: CA });
  });
});
