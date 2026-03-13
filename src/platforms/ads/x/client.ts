import { fetchWithTimeout } from "../../../utils/fetch-timeout.js";

export class XAdsClient {
  private baseUrl = "https://ads-api.x.com/12";

  constructor(private accessToken: string) {}

  private async request<T>(
    path: string,
    method: "GET" | "POST" | "PUT" = "GET",
    body?: Record<string, unknown>
  ): Promise<T> {
    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
    };

    if (body && (method === "POST" || method === "PUT")) {
      options.body = JSON.stringify(body);
    }

    const response = await fetchWithTimeout(`${this.baseUrl}${path}`, options);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `X Ads API error (${response.status}): ${errorBody}`
      );
    }

    return response.json() as Promise<T>;
  }

  async listCampaigns(accountId: string): Promise<unknown> {
    return this.request(`/accounts/${accountId}/campaigns`);
  }

  async createCampaign(
    accountId: string,
    data: Record<string, unknown>
  ): Promise<unknown> {
    return this.request(
      `/accounts/${accountId}/campaigns`,
      "POST",
      data
    );
  }

  async updateCampaign(
    accountId: string,
    campaignId: string,
    data: Record<string, unknown>
  ): Promise<unknown> {
    return this.request(
      `/accounts/${accountId}/campaigns/${campaignId}`,
      "PUT",
      data
    );
  }

  async listLineItems(
    accountId: string,
    campaignId?: string
  ): Promise<unknown> {
    const query = new URLSearchParams();
    if (campaignId) query.set("campaign_ids", campaignId);
    const qs = query.toString();
    return this.request(`/accounts/${accountId}/line_items${qs ? `?${qs}` : ""}`);
  }

  async createLineItem(
    accountId: string,
    data: Record<string, unknown>
  ): Promise<unknown> {
    return this.request(
      `/accounts/${accountId}/line_items`,
      "POST",
      data
    );
  }

  async createPromotedTweet(
    accountId: string,
    data: Record<string, unknown>
  ): Promise<unknown> {
    return this.request(
      `/accounts/${accountId}/promoted_tweets`,
      "POST",
      data
    );
  }

  async getAnalytics(
    accountId: string,
    params: {
      entity: string;
      entity_ids: string[];
      start_time: string;
      end_time: string;
      granularity?: string;
      metric_groups?: string[];
    }
  ): Promise<unknown> {
    const query = new URLSearchParams();
    query.set("entity", params.entity);
    query.set("entity_ids", params.entity_ids.join(","));
    query.set("start_time", params.start_time);
    query.set("end_time", params.end_time);
    if (params.granularity) query.set("granularity", params.granularity);
    if (params.metric_groups?.length) {
      query.set("metric_groups", params.metric_groups.join(","));
    }
    return this.request(
      `/stats/accounts/${accountId}?${query.toString()}`
    );
  }

  async listAudiences(accountId: string): Promise<unknown> {
    return this.request(`/accounts/${accountId}/tailored_audiences`);
  }
}
