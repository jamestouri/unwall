import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { UnwallClient } from "./core/unwall-client.js";
import { registerTools } from "./core/tool-registry.js";

export async function startServer(token: string): Promise<void> {
  const client = new UnwallClient(token);
  const server = new McpServer({
    name: "unwall",
    version: "0.1.0",
  });

  try {
    await registerTools(server, client);
    const transport = new StdioServerTransport();
    await server.connect(transport);
  } catch (err) {
    console.error("[unwall] Fatal error:", err);
    process.exit(1);
  }
}
