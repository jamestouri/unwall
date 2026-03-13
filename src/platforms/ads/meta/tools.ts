import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { UnwallClient } from "../../../core/unwall-client.js";
import { budgetGate } from "../../../core/budget-gate.js";
import { MetaAdsClient } from "./client.js";

const META_CAMPAIGN_STATUSES = ["ACTIVE", "PAUSED", "ARCHIVED"] as const;
const META_AD_STATUSES = ["ACTIVE", "PAUSED", "ARCHIVED"] as const;

export function registerMetaTools(
  server: McpServer,
  client: UnwallClient
): void {
  // ─── READ TOOLS ───────────────────────────────────────────────────────

  server.tool(
    "ads_meta_list_campaigns",
    "List all campaigns in a Meta Ads account with optional status filtering",
    {
      account_id: z.string().describe("Meta Ads account ID (without act_ prefix)"),
      limit: z.number().optional().describe("Maximum number of campaigns to return"),
      status_filter: z.array(z.string()).optional().describe("Filter by status, e.g. ['ACTIVE', 'PAUSED']"),
    },
    async ({ account_id, limit, status_filter }) => {
      try {
        const token = await client.getCredential("meta_ads");
        const api = new MetaAdsClient(token);
        const result = await api.listCampaigns(account_id, {
          limit,
          status: status_filter,
        });
        await client.logAction("ads_meta_list_campaigns", { account_id });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "ads_meta_list_adsets",
    "List ad sets in a Meta Ads account, optionally filtered by campaign",
    {
      account_id: z.string().describe("Meta Ads account ID (without act_ prefix)"),
      campaign_id: z.string().optional().describe("Filter ad sets by campaign ID"),
      limit: z.number().optional().describe("Maximum number of ad sets to return"),
    },
    async ({ account_id, campaign_id, limit }) => {
      try {
        const token = await client.getCredential("meta_ads");
        const api = new MetaAdsClient(token);
        const result = await api.listAdSets(account_id, {
          limit,
          campaignId: campaign_id,
        });
        await client.logAction("ads_meta_list_adsets", { account_id, campaign_id });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "ads_meta_list_ads",
    "List ads in a Meta Ads account, optionally filtered by ad set",
    {
      account_id: z.string().describe("Meta Ads account ID (without act_ prefix)"),
      adset_id: z.string().optional().describe("Filter ads by ad set ID"),
      limit: z.number().optional().describe("Maximum number of ads to return"),
    },
    async ({ account_id, adset_id, limit }) => {
      try {
        const token = await client.getCredential("meta_ads");
        const api = new MetaAdsClient(token);
        const result = await api.listAds(account_id, {
          limit,
          adSetId: adset_id,
        });
        await client.logAction("ads_meta_list_ads", { account_id, adset_id });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "ads_meta_get_insights",
    "Get performance insights for a Meta Ads object (campaign, ad set, or ad)",
    {
      object_id: z.string().describe("ID of the campaign, ad set, or ad to get insights for"),
      date_preset: z.string().optional().describe("Date preset like 'last_7d', 'last_30d', 'today'"),
      time_range: z.object({
        since: z.string().describe("Start date in YYYY-MM-DD format"),
        until: z.string().describe("End date in YYYY-MM-DD format"),
      }).optional().describe("Custom time range"),
      breakdowns: z.string().optional().describe("Breakdown dimensions, e.g. 'age', 'gender', 'country'"),
      fields: z.string().optional().describe("Comma-separated insight fields to return"),
    },
    async ({ object_id, date_preset, time_range, breakdowns, fields }) => {
      try {
        const token = await client.getCredential("meta_ads");
        const api = new MetaAdsClient(token);
        const result = await api.getInsights(object_id, {
          date_preset,
          time_range,
          breakdowns,
          fields,
        });
        await client.logAction("ads_meta_get_insights", { object_id, date_preset });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "ads_meta_list_audiences",
    "List custom audiences in a Meta Ads account",
    {
      account_id: z.string().describe("Meta Ads account ID (without act_ prefix)"),
    },
    async ({ account_id }) => {
      try {
        const token = await client.getCredential("meta_ads");
        const api = new MetaAdsClient(token);
        const result = await api.listAudiences(account_id);
        await client.logAction("ads_meta_list_audiences", { account_id });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    }
  );

  // ─── WRITE TOOLS ──────────────────────────────────────────────────────

  server.tool(
    "ads_meta_create_campaign",
    "Create a new campaign in Meta Ads. Campaign will be created in PAUSED status for safety.",
    {
      account_id: z.string().describe("Meta Ads account ID (without act_ prefix)"),
      name: z.string().describe("Campaign name"),
      objective: z.string().describe("Campaign objective, e.g. 'OUTCOME_TRAFFIC', 'OUTCOME_LEADS'"),
      daily_budget: z.number().optional().describe("Daily budget in cents"),
      lifetime_budget: z.number().optional().describe("Lifetime budget in cents"),
      special_ad_categories: z.array(z.string()).optional().describe("Special ad categories, e.g. ['HOUSING', 'CREDIT']"),
    },
    async ({ account_id, name, objective, daily_budget, lifetime_budget, special_ad_categories }) => {
      try {
        const estimatedCost = daily_budget ?? lifetime_budget ?? 0;
        await budgetGate(client, estimatedCost);

        const token = await client.getCredential("meta_ads");
        const api = new MetaAdsClient(token);
        const result = await api.createCampaign(account_id, {
          name,
          objective,
          status: "PAUSED",
          daily_budget,
          lifetime_budget,
          special_ad_categories: special_ad_categories ?? [],
        });
        await client.logAction("ads_meta_create_campaign", { account_id, name, objective, daily_budget, lifetime_budget });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "ads_meta_update_campaign",
    "Update an existing Meta Ads campaign. Budget gate enforced if budget is changed.",
    {
      campaign_id: z.string().describe("Campaign ID to update"),
      name: z.string().optional().describe("New campaign name"),
      status: z.enum(META_CAMPAIGN_STATUSES).optional().describe("New status"),
      daily_budget: z.number().optional().describe("New daily budget in cents"),
      lifetime_budget: z.number().optional().describe("New lifetime budget in cents"),
    },
    async ({ campaign_id, name, status, daily_budget, lifetime_budget }) => {
      try {
        if (daily_budget !== undefined || lifetime_budget !== undefined) {
          await budgetGate(client, daily_budget ?? lifetime_budget ?? 0);
        }

        const token = await client.getCredential("meta_ads");
        const api = new MetaAdsClient(token);
        const data: Record<string, unknown> = {};
        if (name !== undefined) data.name = name;
        if (status !== undefined) data.status = status;
        if (daily_budget !== undefined) data.daily_budget = daily_budget;
        if (lifetime_budget !== undefined) data.lifetime_budget = lifetime_budget;

        const result = await api.updateCampaign(campaign_id, data);
        await client.logAction("ads_meta_update_campaign", { campaign_id, ...data });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "ads_meta_create_adset",
    "Create a new ad set in Meta Ads. Ad set will be created in PAUSED status for safety.",
    {
      account_id: z.string().describe("Meta Ads account ID (without act_ prefix)"),
      campaign_id: z.string().describe("Parent campaign ID"),
      name: z.string().describe("Ad set name"),
      targeting: z.record(z.unknown()).describe("Targeting spec object"),
      daily_budget: z.number().optional().describe("Daily budget in cents"),
      bid_amount: z.number().optional().describe("Bid amount in cents"),
      optimization_goal: z.string().describe("Optimization goal, e.g. 'LINK_CLICKS', 'IMPRESSIONS'"),
      billing_event: z.string().describe("Billing event, e.g. 'IMPRESSIONS', 'LINK_CLICKS'"),
    },
    async ({ account_id, campaign_id, name, targeting, daily_budget, bid_amount, optimization_goal, billing_event }) => {
      try {
        const estimatedCost = daily_budget ?? 0;
        await budgetGate(client, estimatedCost);

        const token = await client.getCredential("meta_ads");
        const api = new MetaAdsClient(token);
        const result = await api.createAdSet(account_id, {
          campaign_id,
          name,
          targeting,
          status: "PAUSED",
          daily_budget,
          bid_amount,
          optimization_goal,
          billing_event,
        });
        await client.logAction("ads_meta_create_adset", { account_id, campaign_id, name, optimization_goal });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "ads_meta_update_adset",
    "Update an existing Meta Ads ad set. Budget gate enforced if budget is changed.",
    {
      adset_id: z.string().describe("Ad set ID to update"),
      name: z.string().optional().describe("New ad set name"),
      status: z.enum(META_AD_STATUSES).optional().describe("New status"),
      daily_budget: z.number().optional().describe("New daily budget in cents"),
      targeting: z.record(z.unknown()).optional().describe("New targeting spec"),
      bid_amount: z.number().optional().describe("New bid amount in cents"),
    },
    async ({ adset_id, name, status, daily_budget, targeting, bid_amount }) => {
      try {
        if (daily_budget !== undefined) {
          await budgetGate(client, daily_budget);
        }

        const token = await client.getCredential("meta_ads");
        const api = new MetaAdsClient(token);
        const data: Record<string, unknown> = {};
        if (name !== undefined) data.name = name;
        if (status !== undefined) data.status = status;
        if (daily_budget !== undefined) data.daily_budget = daily_budget;
        if (targeting !== undefined) data.targeting = targeting;
        if (bid_amount !== undefined) data.bid_amount = bid_amount;

        const result = await api.updateAdSet(adset_id, data);
        await client.logAction("ads_meta_update_adset", { adset_id, ...data });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "ads_meta_create_ad",
    "Create a new ad in Meta Ads. Ad will be created in PAUSED status for safety.",
    {
      account_id: z.string().describe("Meta Ads account ID (without act_ prefix)"),
      adset_id: z.string().describe("Parent ad set ID"),
      name: z.string().describe("Ad name"),
      creative: z.record(z.unknown()).describe("Ad creative spec object"),
    },
    async ({ account_id, adset_id, name, creative }) => {
      try {
        await budgetGate(client, 0);

        const token = await client.getCredential("meta_ads");
        const api = new MetaAdsClient(token);
        const result = await api.createAd(account_id, {
          adset_id,
          name,
          creative,
          status: "PAUSED",
        });
        await client.logAction("ads_meta_create_ad", { account_id, adset_id, name });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "ads_meta_update_ad",
    "Update an existing Meta Ads ad",
    {
      ad_id: z.string().describe("Ad ID to update"),
      name: z.string().optional().describe("New ad name"),
      status: z.enum(META_AD_STATUSES).optional().describe("New status"),
      creative: z.record(z.unknown()).optional().describe("New creative spec"),
    },
    async ({ ad_id, name, status, creative }) => {
      try {
        const token = await client.getCredential("meta_ads");
        const api = new MetaAdsClient(token);
        const data: Record<string, unknown> = {};
        if (name !== undefined) data.name = name;
        if (status !== undefined) data.status = status;
        if (creative !== undefined) data.creative = creative;

        const result = await api.updateAd(ad_id, data);
        await client.logAction("ads_meta_update_ad", { ad_id, ...data });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "ads_meta_upload_image",
    "Upload an image to a Meta Ads account from a URL",
    {
      account_id: z.string().describe("Meta Ads account ID (without act_ prefix)"),
      image_url: z.string().url().describe("URL of the image to upload"),
      name: z.string().optional().describe("Optional name for the image"),
    },
    async ({ account_id, image_url, name: imageName }) => {
      try {
        await budgetGate(client, 0);

        const token = await client.getCredential("meta_ads");
        const api = new MetaAdsClient(token);
        const result = await api.uploadImage(account_id, image_url);
        await client.logAction("ads_meta_upload_image", { account_id, image_url, name: imageName });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    }
  );
}
