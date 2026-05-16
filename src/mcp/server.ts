import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { McpCtx } from "./context.js";
import { openMcp, reconcileAll } from "./context.js";
import { registerTools } from "./tools.js";

export function buildServer(ctx: McpCtx): McpServer {
  const server = new McpServer({ name: "code-memory-service", version: "0.1.0" });
  registerTools(server, ctx);
  return server;
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) { resolve(undefined); return; }
      try { resolve(JSON.parse(raw)); }
      catch { reject(Object.assign(new Error("invalid JSON"), { code: 400 })); }
    });
    req.on("error", reject);
  });
}

function sendError(res: ServerResponse, status: number, message: string): void {
  const body = JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message }, id: null });
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(body);
}

export function createMcpHttpServer(ctx: McpCtx): ReturnType<typeof createHttpServer> {
  const httpServer = createHttpServer(async (req, res) => {
    if (req.url !== "/mcp") { sendError(res, 404, "not found"); return; }

    if (req.method === "POST") {
      let body: unknown;
      try {
        body = await readBody(req);
      } catch {
        sendError(res, 400, "invalid JSON body");
        return;
      }
      const server = buildServer(ctx);
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      res.on("close", () => { transport.close(); server.close(); });
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
      return;
    }

    if (req.method === "GET" || req.method === "DELETE") {
      sendError(res, 405, "stateless mode: sessions not supported");
      return;
    }

    sendError(res, 405, "method not allowed");
  });

  return httpServer;
}

async function main(): Promise<void> {
  const ctx = openMcp();
  await reconcileAll(ctx);

  const httpServer = createMcpHttpServer(ctx);

  process.on("SIGTERM", () => {
    httpServer.close(() => { ctx.db.close(); process.exit(0); });
  });
  process.on("SIGINT", () => {
    httpServer.close(() => { ctx.db.close(); process.exit(0); });
  });

  const port = Number(process.env.CMS_PORT ?? 8765);
  httpServer.listen(port, "0.0.0.0", () => {
    console.error(`code-memory-service listening on :${port}`);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
