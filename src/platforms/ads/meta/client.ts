import { fetchWithTimeout } from "../../../utils/fetch-timeout.js";

export class MetaAdsClient {
  private baseUrl = "https://graph.facebook.com/v22.0";

  constructor(private accessToken: string) {}

  private async request<T>(
    path: string,
    method: "GET" | "POST" = "GET",
    body?: Record<string, unknown>
  ): Promise<T> {
    const url = `${this.baseUrl}/${path}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
    };

    const options: RequestInit = { method, headers };

    if (body && method === "POST") {
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }

    const response = await fetchWithTimeout(url, options);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Meta API error (${response.status}): ${errorBody}`
      );
    }

    return response.json() as Promise<T>;
  }

  async listCampaigns(
    accountId: string,
    params?: { limit?: number; status?: string[]; fields?: string }
  ): Promise<unknown> {
    const query = new URLSearchParams();
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.status?.length) query.set("filtering", JSON.stringify([{ field: "effective_status", operator: "IN", value: params.status }]));
    query.set("fields", params?.fields ?? "id,name,status,objective,daily_budget,lifetime_budget,created_time,updated_time");
    return this.request(`act_${accountId}/campaigns?${query.toString()}`);
  }

  async createCampaign(
    accountId: string,
    data: Record<string, unknown>
  ): Promise<unknown> {
    return this.request(`act_${accountId}/campaigns`, "POST", data);
  }

  async updateCampaign(
    campaignId: string,
    data: Record<string, unknown>
  ): Promise<unknown> {
    return this.request(campaignId, "POST", data);
  }

  async listAdSets(
    accountId: string,
    params?: { limit?: number; campaignId?: string; fields?: string }
  ): Promise<unknown> {
    const query = new URLSearchParams();
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.campaignId) {
      query.set("filtering", JSON.stringify([{ field: "campaign_id", operator: "EQUAL", value: params.campaignId }]));
    }
    query.set("fields", params?.fields ?? "id,name,status,campaign_id,daily_budget,targeting,optimization_goal,billing_event,created_time");
    return this.request(`act_${accountId}/adsets?${query.toString()}`);
  }

  async createAdSet(
    accountId: string,
    data: Record<string, unknown>
  ): Promise<unknown> {
    return this.request(`act_${accountId}/adsets`, "POST", data);
  }

  async updateAdSet(
    adSetId: string,
    data: Record<string, unknown>
  ): Promise<unknown> {
    return this.request(adSetId, "POST", data);
  }

  async listAds(
    accountId: string,
    params?: { limit?: number; adSetId?: string; fields?: string }
  ): Promise<unknown> {
    const query = new URLSearchParams();
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.adSetId) {
      query.set("filtering", JSON.stringify([{ field: "adset_id", operator: "EQUAL", value: params.adSetId }]));
    }
    query.set("fields", params?.fields ?? "id,name,status,adset_id,creative,created_time,updated_time");
    return this.request(`act_${accountId}/ads?${query.toString()}`);
  }

  async createAd(
    accountId: string,
    data: Record<string, unknown>
  ): Promise<unknown> {
    return this.request(`act_${accountId}/ads`, "POST", data);
  }

  async updateAd(
    adId: string,
    data: Record<string, unknown>
  ): Promise<unknown> {
    return this.request(adId, "POST", data);
  }

  async uploadImage(
    accountId: string,
    imageUrl: string
  ): Promise<unknown> {
    return this.request(`act_${accountId}/adimages`, "POST", {
      url: imageUrl,
    });
  }

  async getInsights(
    objectId: string,
    params: { date_preset?: string; time_range?: { since: string; until: string }; breakdowns?: string; fields?: string }
  ): Promise<unknown> {
    const query = new URLSearchParams();
    if (params.date_preset) query.set("date_preset", params.date_preset);
    if (params.time_range) query.set("time_range", JSON.stringify(params.time_range));
    if (params.breakdowns) query.set("breakdowns", params.breakdowns);
    query.set("fields", params.fields ?? "impressions,clicks,spend,cpc,cpm,ctr,reach,frequency,actions");
    return this.request(`${objectId}/insights?${query.toString()}`);
  }

  async listAudiences(accountId: string): Promise<unknown> {
    return this.request(
      `act_${accountId}/customaudiences?fields=id,name,subtype,approximate_count,data_source`
    );
  }
}
