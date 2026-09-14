import { createServer as createHttpServer, type Server } from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";
import express, { type Express, type Request, type Response } from "express";
import { SlaStore } from "./store.js";
import type { DashboardSnapshot } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// public/ lives at the repo root, one level up from src/ (and from dist/).
const PUBLIC_DIR = path.resolve(__dirname, "..", "public");

const TICK_MS = 1000;

export interface AppBundle {
  app: Express;
  store: SlaStore;
  /** Stop the internal simulation interval. */
  stop: () => void;
}

export function createApp(store: SlaStore = new SlaStore()): AppBundle {
  const app = express();
  app.use(express.json());

  const sseClients = new Set<Response>();

  const broadcast = (snapshot: DashboardSnapshot): void => {
    const payload = `data: ${JSON.stringify(snapshot)}\n\n`;
    for (const client of sseClients) {
      client.write(payload);
    }
  };

  app.get("/api/state", (_req: Request, res: Response) => {
    res.json(store.snapshot(Date.now()));
  });

  app.get("/api/stream", (req: Request, res: Response) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.write(`retry: 2000\n\n`);
    res.write(`data: ${JSON.stringify(store.snapshot(Date.now()))}\n\n`);

    sseClients.add(res);
    req.on("close", () => {
      sseClients.delete(res);
    });
  });

  app.post("/api/commitments/:id/resolve", (req: Request, res: Response) => {
    const commitment = store.resolve(req.params.id ?? "", Date.now());
    if (!commitment) {
      res.status(404).json({ error: "commitment not found" });
      return;
    }
    const snapshot = store.snapshot(Date.now());
    broadcast(snapshot);
    res.json(snapshot);
  });

  app.post("/api/commitments", (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const commitment = store.open(
      {
        partnerId: typeof body.partnerId === "string" ? body.partnerId : undefined,
        subject: typeof body.subject === "string" ? body.subject : undefined,
        priority:
          body.priority === "P1" || body.priority === "P2" || body.priority === "P3"
            ? body.priority
            : undefined,
        targetMinutes:
          typeof body.targetMinutes === "number" ? body.targetMinutes : undefined,
      },
      Date.now(),
    );
    broadcast(store.snapshot(Date.now()));
    res.status(201).json(commitment);
  });

  app.use(express.static(PUBLIC_DIR));

  app.get("/", (_req: Request, res: Response) => {
    res.sendFile(path.join(PUBLIC_DIR, "index.html"));
  });

  const interval = setInterval(() => {
    const snapshot = store.tick(Date.now());
    broadcast(snapshot);
  }, TICK_MS);
  // Don't keep the process alive solely for the ticker (helps tests exit).
  interval.unref?.();

  const stop = (): void => {
    clearInterval(interval);
    for (const client of sseClients) {
      client.end();
    }
    sseClients.clear();
  };

  return { app, store, stop };
}

export function createServer(store?: SlaStore): {
  server: Server;
  bundle: AppBundle;
} {
  const bundle = createApp(store);
  const server = createHttpServer(bundle.app);
  server.on("close", bundle.stop);
  return { server, bundle };
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
const isMain = invokedPath !== "" && fileURLToPath(import.meta.url) === invokedPath;

if (isMain) {
  const PORT = Number(process.env.PORT ?? 3000);
  const HOST = process.env.HOST ?? "0.0.0.0";
  const { server } = createServer();
  server.listen(PORT, HOST, () => {
    const shown = HOST === "0.0.0.0" ? "localhost" : HOST;
    // eslint-disable-next-line no-console
    console.log(`SLA tracker listening at http://${shown}:${PORT}`);
  });
}
