import { fetchWithTimeout } from "../../../utils/fetch-timeout.js";

export class GoogleAdsClient {
  private baseUrl = "https://googleads.googleapis.com/v18";

  constructor(
    private accessToken: string,
    private developerToken: string
  ) {}

  private async request<T>(
    path: string,
    method: "GET" | "POST" = "POST",
    body?: unknown
  ): Promise<T> {
    const response = await fetchWithTimeout(`${this.baseUrl}/${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "developer-token": this.developerToken,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Google Ads API error (${response.status}): ${errorBody}`
      );
    }

    return response.json() as Promise<T>;
  }

  async searchStream(
    customerId: string,
    query: string
  ): Promise<unknown> {
    return this.request(
      `customers/${customerId}/googleAds:searchStream`,
      "POST",
      { query }
    );
  }

  async mutate(
    customerId: string,
    resource: string,
    operations: unknown[]
  ): Promise<unknown> {
    return this.request(
      `customers/${customerId}/${resource}:mutate`,
      "POST",
      { operations }
    );
  }

  async generateKeywordIdeas(
    customerId: string,
    params: {
      keywords: string[];
      language?: string;
      geoTargetConstants?: string[];
    }
  ): Promise<unknown> {
    const body: Record<string, unknown> = {
      keywordSeed: { keywords: params.keywords },
    };

    if (params.language) {
      body.language = params.language;
    }

    if (params.geoTargetConstants?.length) {
      body.geoTargetConstants = params.geoTargetConstants;
    }

    return this.request(
      `customers/${customerId}:generateKeywordIdeas`,
      "POST",
      body
    );
  }
}
