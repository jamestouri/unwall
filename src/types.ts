import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export { McpServer };

export interface UnwallBalance {
  available: number;
  total_spent: number;
  budget_limit: number | null;
  currency: string;
}

export type ConnectedPlatform = "meta_ads" | "google_ads" | "x_ads";

export type ToolCategory = "read" | "write";

export type PlatformToolRegistrar = (
  server: McpServer,
  client: import("./core/unwall-client.js").UnwallClient
) => void;
