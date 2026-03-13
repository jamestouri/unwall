import type { McpServer } from "../types.js";
import type { UnwallClient } from "./unwall-client.js";
import type { ConnectedPlatform, PlatformToolRegistrar } from "../types.js";

const PLATFORM_MODULES: Record<ConnectedPlatform, string> = {
  meta_ads: "../platforms/ads/meta/tools.js",
  google_ads: "../platforms/ads/google/tools.js",
  x_ads: "../platforms/ads/x/tools.js",
};

const PLATFORM_EXPORTS: Record<ConnectedPlatform, string> = {
  meta_ads: "registerMetaTools",
  google_ads: "registerGoogleTools",
  x_ads: "registerXTools",
};

export async function registerTools(
  server: McpServer,
  client: UnwallClient
): Promise<void> {
  const connected = await client.getConnectedPlatforms();

  for (const platform of connected) {
    const modulePath = PLATFORM_MODULES[platform];
    const exportName = PLATFORM_EXPORTS[platform];

    if (!modulePath) {
      console.error(`[unwall] Unknown platform: ${platform}`);
      continue;
    }

    try {
      const mod = await import(modulePath);
      const registrar: PlatformToolRegistrar = mod[exportName];

      if (typeof registrar !== "function") {
        console.error(`[unwall] ${exportName} not found in ${modulePath}`);
        continue;
      }

      registrar(server, client);
      console.error(`[unwall] Registered tools for ${platform}`);
    } catch (err) {
      console.error(`[unwall] Failed to load ${platform}:`, err);
    }
  }

  if (connected.length === 0) {
    console.error(
      "[unwall] No platforms connected. Connect platforms at unwall.xyz/dashboard"
    );
  }
}
