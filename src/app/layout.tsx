import type { ReactNode } from "react";
import type { Metadata } from "next";

// Next requires a root layout even when the app has only route handlers; the
// default /_not-found document renders through it. Nothing else does: the
// dashboard UI is the sla-tracking mini-app (specs/2026-10-16-mini-app-split-design.md).
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  title: "SLA tracking API",
  description: "Proactive real-time SLA tracking backend",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
