import type { UnwallBalance, ConnectedPlatform } from "../types.js";
import { fetchWithTimeout } from "../utils/fetch-timeout.js";

export class UnwallClient {
  private baseUrl = "https://api.unwall.xyz";

  constructor(private token: string) {}

  private async request<T>(
    path: string,
    options?: RequestInit,
    retries = 3
  ): Promise<T> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const response = await fetchWithTimeout(`${this.baseUrl}${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
          ...options?.headers,
        },
      });

      if (response.status === 429 && attempt < retries) {
        const retryAfter = response.headers.get("retry-after");
        const delayMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 1000 * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      if (!response.ok) {
        switch (response.status) {
          case 401:
            throw new Error("Invalid UNWALL_TOKEN — check your project token at unwall.xyz");
          case 403:
            throw new Error(`Platform not connected — connect it at unwall.xyz/dashboard`);
          case 404:
            throw new Error(`Resource not found: ${path}`);
          case 429:
            throw new Error("Rate limited — too many requests to Unwall API (retries exhausted)");
          default:
            throw new Error(`Unwall API error (${response.status}): ${await response.text()}`);
        }
      }

      return response.json() as Promise<T>;
    }

    throw new Error(`Unwall API request failed after ${retries} retries: ${path}`);
  }

  async getBalance(): Promise<UnwallBalance> {
    return this.request<UnwallBalance>("/v1/balance");
  }

  async getCredential(platform: ConnectedPlatform): Promise<string> {
    const data = await this.request<{ token: string }>(
      `/v1/credentials/${platform}`
    );
    return data.token;
  }

  async getConnectedPlatforms(): Promise<ConnectedPlatform[]> {
    const data = await this.request<{ platforms: ConnectedPlatform[] }>(
      "/v1/connections"
    );
    return data.platforms;
  }

  async logAction(
    action: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    await this.request("/v1/actions", {
      method: "POST",
      body: JSON.stringify({ action, metadata, timestamp: new Date().toISOString() }),
    });
  }
}
