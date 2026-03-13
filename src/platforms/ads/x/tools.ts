import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { UnwallClient } from "../../../core/unwall-client.js";
import { budgetGate } from "../../../core/budget-gate.js";
import { XAdsClient } from "./client.js";

/** Micros to cents: 1 USD = 1,000,000 micros = 100 cents */
const MICROS_TO_CENTS = 1_000_000 / 100;

export function registerXTools(
  server: McpServer,
  client: UnwallClient
): void {
  // ─── READ TOOLS ───────────────────────────────────────────────────────

  server.tool(
    "ads_x_list_campaigns",
    "List all campaigns in an X Ads account with optional status filtering",
    {
      account_id: z.string().describe("X Ads account ID"),
      status_filter: z.enum(["ACTIVE", "PAUSED", "DRAFT"]).optional().describe("Filter by entity_status"),
    },
    async ({ account_id, status_filter }) => {
      try {
        const token = await client.getCredential("x_ads");
        const api = new XAdsClient(token);
        const result = await api.listCampaigns(account_id);

        let data = result;
        if (status_filter) {
          const campaigns = (result as any)?.data ?? [];
          data = {
            ...(result as any),
            data: campaigns.filter(
              (c: any) => c.entity_status === status_filter
            ),
          };
        }

        await client.logAction("ads_x_list_campaigns", { account_id, status_filter });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "ads_x_list_line_items",
    "List line items in an X Ads account, optionally filtered by campaign",
    {
      account_id: z.string().describe("X Ads account ID"),
      campaign_id: z.string().optional().describe("Filter line items by campaign ID"),
    },
    async ({ account_id, campaign_id }) => {
      try {
        const token = await client.getCredential("x_ads");
        const api = new XAdsClient(token);
        const result = await api.listLineItems(account_id, campaign_id);
        await client.logAction("ads_x_list_line_items", { account_id, campaign_id });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "ads_x_get_analytics",
    "Get analytics data for X Ads entities (campaigns, line items, etc.)",
    {
      account_id: z.string().describe("X Ads account ID"),
      entity_type: z.string().describe("Entity type: 'CAMPAIGN', 'LINE_ITEM', 'PROMOTED_TWEET'"),
      entity_ids: z.array(z.string()).min(1).describe("IDs of entities to get analytics for"),
      start_time: z.string().describe("Start time in ISO 8601 format"),
      end_time: z.string().describe("End time in ISO 8601 format"),
      granularity: z.string().optional().describe("Granularity: 'HOUR', 'DAY', 'TOTAL'. Defaults to 'DAY'"),
      metrics: z.array(z.string()).optional().describe("Metric groups, e.g. ['ENGAGEMENT', 'BILLING', 'VIDEO']"),
    },
    async ({ account_id, entity_type, entity_ids, start_time, end_time, granularity, metrics }) => {
      try {
        const token = await client.getCredential("x_ads");
        const api = new XAdsClient(token);
        const result = await api.getAnalytics(account_id, {
          entity: entity_type,
          entity_ids,
          start_time,
          end_time,
          granularity: granularity ?? "DAY",
          metric_groups: metrics,
        });
        await client.logAction("ads_x_get_analytics", { account_id, entity_type, entity_ids });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "ads_x_list_audiences",
    "List tailored audiences in an X Ads account",
    {
      account_id: z.string().describe("X Ads account ID"),
    },
    async ({ account_id }) => {
      try {
        const token = await client.getCredential("x_ads");
        const api = new XAdsClient(token);
        const result = await api.listAudiences(account_id);
        await client.logAction("ads_x_list_audiences", { account_id });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    }
  );

  // ─── WRITE TOOLS ──────────────────────────────────────────────────────

  server.tool(
    "ads_x_create_campaign",
    "Create a new campaign in X Ads. Campaign will be created in PAUSED status for safety.",
    {
      account_id: z.string().describe("X Ads account ID"),
      name: z.string().describe("Campaign name"),
      funding_instrument_id: z.string().describe("Funding instrument ID for billing"),
      daily_budget_amount_local_micro: z.number().describe("Daily budget in local micro-currency (1 USD = 1,000,000 micros)"),
      start_time: z.string().optional().describe("Campaign start time in ISO 8601 format"),
      end_time: z.string().optional().describe("Campaign end time in ISO 8601 format"),
    },
    async ({ account_id, name, funding_instrument_id, daily_budget_amount_local_micro, start_time, end_time }) => {
      try {
        await budgetGate(client, daily_budget_amount_local_micro / MICROS_TO_CENTS);

        const token = await client.getCredential("x_ads");
        const api = new XAdsClient(token);

        const data: Record<string, unknown> = {
          name,
          funding_instrument_id,
          daily_budget_amount_local_micro,
          entity_status: "PAUSED",
        };
        if (start_time) data.start_time = start_time;
        if (end_time) data.end_time = end_time;

        const result = await api.createCampaign(account_id, data);
        await client.logAction("ads_x_create_campaign", {
          account_id,
          name,
          daily_budget_amount_local_micro,
        });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "ads_x_update_campaign",
    "Update an existing X Ads campaign. Budget gate enforced if budget is changed.",
    {
      account_id: z.string().describe("X Ads account ID"),
      campaign_id: z.string().describe("Campaign ID to update"),
      name: z.string().optional().describe("New campaign name"),
      entity_status: z.enum(["ACTIVE", "PAUSED"]).optional().describe("New status"),
      daily_budget_amount_local_micro: z.number().optional().describe("New daily budget in local micro-currency"),
    },
    async ({ account_id, campaign_id, name, entity_status, daily_budget_amount_local_micro }) => {
      try {
        if (daily_budget_amount_local_micro !== undefined) {
          await budgetGate(client, daily_budget_amount_local_micro / MICROS_TO_CENTS);
        }

        const token = await client.getCredential("x_ads");
        const api = new XAdsClient(token);

        const data: Record<string, unknown> = {};
        if (name !== undefined) data.name = name;
        if (entity_status !== undefined) data.entity_status = entity_status;
        if (daily_budget_amount_local_micro !== undefined) {
          data.daily_budget_amount_local_micro = daily_budget_amount_local_micro;
        }

        const result = await api.updateCampaign(account_id, campaign_id, data);
        await client.logAction("ads_x_update_campaign", { account_id, campaign_id, ...data });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "ads_x_create_line_item",
    "Create a new line item in X Ads. Line item will be created in PAUSED status for safety.",
    {
      account_id: z.string().describe("X Ads account ID"),
      campaign_id: z.string().describe("Parent campaign ID"),
      name: z.string().describe("Line item name"),
      product_type: z.string().describe("Product type, e.g. 'PROMOTED_TWEETS', 'PROMOTED_ACCOUNTS'"),
      placements: z.array(z.string()).min(1).describe("Ad placements, e.g. ['ALL_ON_TWITTER', 'TWITTER_TIMELINE']"),
      bid_amount_local_micro: z.number().describe("Bid amount in local micro-currency"),
      objective: z.string().optional().describe("Line item objective, e.g. 'TWEET_ENGAGEMENTS', 'WEBSITE_CLICKS'"),
    },
    async ({ account_id, campaign_id, name, product_type, placements, bid_amount_local_micro, objective }) => {
      try {
        await budgetGate(client, bid_amount_local_micro / MICROS_TO_CENTS);

        const token = await client.getCredential("x_ads");
        const api = new XAdsClient(token);

        const data: Record<string, unknown> = {
          campaign_id,
          name,
          product_type,
          placements,
          bid_amount_local_micro,
          entity_status: "PAUSED",
        };
        if (objective) data.objective = objective;

        const result = await api.createLineItem(account_id, data);
        await client.logAction("ads_x_create_line_item", {
          account_id,
          campaign_id,
          name,
          product_type,
          bid_amount_local_micro,
        });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "ads_x_create_promoted_tweet",
    "Promote an existing tweet through an X Ads line item",
    {
      account_id: z.string().describe("X Ads account ID"),
      line_item_id: z.string().describe("Line item ID to associate the promoted tweet with"),
      tweet_id: z.string().describe("ID of the tweet to promote"),
    },
    async ({ account_id, line_item_id, tweet_id }) => {
      try {
        await budgetGate(client, 0);

        const token = await client.getCredential("x_ads");
        const api = new XAdsClient(token);
        const result = await api.createPromotedTweet(account_id, {
          line_item_id,
          tweet_ids: [tweet_id],
        });
        await client.logAction("ads_x_create_promoted_tweet", {
          account_id,
          line_item_id,
          tweet_id,
        });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    }
  );
}
