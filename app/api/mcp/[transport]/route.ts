/**
 * app/api/mcp/[transport]/route.ts
 * Clown MCP Server — Streamable HTTP transport.
 * Mail/Notlar/Görevler/Takvim tool'larını dışarıdan (Claude Desktop, başka
 * MCP client'ları) kullanıma açar. lib/assistant/tools.ts'deki tanımları
 * tek kaynak olarak kullanır.
 *
 * Güvenlik: Authorization: Bearer <MCP_SECRET> header'ı zorunludur.
 */
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { assistantTools } from "@/lib/assistant/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = createMcpHandler(
  (server) => {
    for (const t of assistantTools) {
      server.registerTool(
        t.name,
        {
          title: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        },
        async (args: unknown) => {
          try {
            const text = await t.run(t.inputSchema.parse(args ?? {}));
            return { content: [{ type: "text" as const, text }] };
          } catch (err: any) {
            return {
              content: [{ type: "text" as const, text: `Hata: ${err?.message || "Bilinmeyen hata"}` }],
              isError: true,
            };
          }
        }
      );
    }
  },
  { serverInfo: { name: "clown-mcp", version: "1.0.0" } }
);

async function verifyToken(_req: Request, bearerToken?: string) {
  const secret = process.env.MCP_SECRET;
  if (!secret || !bearerToken || bearerToken !== secret) return undefined;
  return { token: bearerToken, clientId: "clown", scopes: [] };
}

const authHandler = withMcpAuth(handler, verifyToken, { required: true });

export { authHandler as GET, authHandler as POST };
