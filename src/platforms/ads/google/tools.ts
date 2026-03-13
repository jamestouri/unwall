import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { UnwallClient } from "../../../core/unwall-client.js";
import { budgetGate } from "../../../core/budget-gate.js";
import { GoogleAdsClient } from "./client.js";

const VALID_CAMPAIGN_STATUSES = ["ENABLED", "PAUSED", "REMOVED", "UNKNOWN", "UNSPECIFIED"] as const;
const VALID_GAQL_DATE_RANGES = [
  "TODAY", "YESTERDAY", "LAST_7_DAYS", "LAST_14_DAYS", "LAST_30_DAYS",
  "THIS_MONTH", "LAST_MONTH", "THIS_QUARTER", "LAST_QUARTER",
] as const;
const GAQL_IDENTIFIER_RE = /^[a-z_][a-z0-9_.]*$/;
const GAQL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function assertValidGaqlIdentifier(value: string, label: string): void {
  if (!GAQL_IDENTIFIER_RE.test(value)) {
    throw new Error(`Invalid ${label}: "${value}". Must be a valid GAQL field name (lowercase letters, digits, underscores, dots).`);
  }
}

/** Micros to cents: 1 USD = 1,000,000 micros = 100 cents → 1 micro = 100/1,000,000 = 0.0001 cents */
const MICROS_TO_CENTS = 1_000_000 / 100; // 10,000

export function registerGoogleTools(
  server: McpServer,
  client: UnwallClient
): void {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!developerToken) {
    console.error(
      "[unwall] GOOGLE_ADS_DEVELOPER_TOKEN is not set. Google Ads tools will fail. " +
      "Set this environment variable before starting the server."
    );
  }

  function getDeveloperToken(): string {
    if (!developerToken) {
      throw new Error("GOOGLE_ADS_DEVELOPER_TOKEN environment variable is required for Google Ads operations.");
    }
    return developerToken;
  }

  // ─── READ TOOLS ───────────────────────────────────────────────────────

  server.tool(
    "ads_google_list_campaigns",
    "List all campaigns in a Google Ads account with optional status filtering",
    {
      customer_id: z.string().describe("Google Ads customer ID (without dashes)"),
      status_filter: z.enum(VALID_CAMPAIGN_STATUSES).optional().describe("Filter by status, e.g. 'ENABLED', 'PAUSED'"),
    },
    async ({ customer_id, status_filter }) => {
      try {
        const token = await client.getCredential("google_ads");
        const api = new GoogleAdsClient(token, getDeveloperToken());

        let query = `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, campaign.campaign_budget, campaign.start_date, campaign.end_date FROM campaign`;
        if (status_filter) {
          query += ` WHERE campaign.status = '${status_filter}'`;
        }

        const result = await api.searchStream(customer_id, query);
        await client.logAction("ads_google_list_campaigns", { customer_id, status_filter });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "ads_google_list_ad_groups",
    "List ad groups in a Google Ads account, optionally filtered by campaign",
    {
      customer_id: z.string().describe("Google Ads customer ID (without dashes)"),
      campaign_id: z.string().regex(/^\d+$/, "Campaign ID must be numeric").optional().describe("Filter by campaign ID"),
    },
    async ({ customer_id, campaign_id }) => {
      try {
        const token = await client.getCredential("google_ads");
        const api = new GoogleAdsClient(token, getDeveloperToken());

        let query = `SELECT ad_group.id, ad_group.name, ad_group.status, ad_group.campaign, ad_group.cpc_bid_micros, ad_group.type FROM ad_group`;
        if (campaign_id) {
          query += ` WHERE campaign.id = ${campaign_id}`;
        }

        const result = await api.searchStream(customer_id, query);
        await client.logAction("ads_google_list_ad_groups", { customer_id, campaign_id });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "ads_google_keyword_research",
    "Generate keyword ideas for Google Ads using seed keywords",
    {
      customer_id: z.string().describe("Google Ads customer ID (without dashes)"),
      keywords: z.array(z.string()).describe("Seed keywords to generate ideas from"),
      language_id: z.string().optional().describe("Language criterion ID, e.g. '1000' for English"),
      geo_target: z.string().optional().describe("Geo target criterion ID, e.g. '2840' for United States"),
    },
    async ({ customer_id, keywords, language_id, geo_target }) => {
      try {
        const token = await client.getCredential("google_ads");
        const api = new GoogleAdsClient(token, getDeveloperToken());

        const geoTargetConstants = geo_target
          ? [`geoTargetConstants/${geo_target}`]
          : undefined;
        const language = language_id
          ? `languageConstants/${language_id}`
          : undefined;

        const result = await api.generateKeywordIdeas(customer_id, {
          keywords,
          language,
          geoTargetConstants,
        });
        await client.logAction("ads_google_keyword_research", { customer_id, keywords });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "ads_google_get_performance_report",
    "Get a performance report for Google Ads campaigns with customizable metrics and date range",
    {
      customer_id: z.string().describe("Google Ads customer ID (without dashes)"),
      date_range: z.string().describe("Date range, e.g. 'LAST_7_DAYS', 'LAST_30_DAYS', or 'YYYY-MM-DD,YYYY-MM-DD'"),
      metrics: z.array(z.string()).optional().describe("Metrics to include, e.g. ['impressions', 'clicks', 'cost_micros', 'conversions']"),
      segments: z.array(z.string()).optional().describe("Segments to break down by, e.g. ['date', 'device']"),
    },
    async ({ customer_id, date_range, metrics, segments }) => {
      try {
        const token = await client.getCredential("google_ads");
        const api = new GoogleAdsClient(token, getDeveloperToken());

        // Validate metric and segment identifiers to prevent injection
        if (metrics?.length) {
          for (const m of metrics) assertValidGaqlIdentifier(m, "metric");
        }
        if (segments?.length) {
          for (const s of segments) assertValidGaqlIdentifier(s, "segment");
        }

        const metricFields = metrics?.length
          ? metrics.map((m) => `metrics.${m}`).join(", ")
          : "metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.ctr, metrics.average_cpc";

        const segmentFields = segments?.length
          ? ", " + segments.map((s) => `segments.${s}`).join(", ")
          : "";

        let dateClause: string;
        if (date_range.includes(",")) {
          const [start, end] = date_range.split(",");
          const startTrimmed = start.trim();
          const endTrimmed = end.trim();
          if (!GAQL_DATE_RE.test(startTrimmed) || !GAQL_DATE_RE.test(endTrimmed)) {
            throw new Error(`Invalid date range format. Use YYYY-MM-DD,YYYY-MM-DD or a preset like LAST_30_DAYS.`);
          }
          dateClause = `segments.date BETWEEN '${startTrimmed}' AND '${endTrimmed}'`;
        } else {
          if (!VALID_GAQL_DATE_RANGES.includes(date_range as typeof VALID_GAQL_DATE_RANGES[number])) {
            throw new Error(`Invalid date range preset: "${date_range}". Valid values: ${VALID_GAQL_DATE_RANGES.join(", ")}`);
          }
          dateClause = `segments.date DURING ${date_range}`;
        }

        const query = `SELECT campaign.id, campaign.name, ${metricFields}${segmentFields} FROM campaign WHERE ${dateClause}`;

        const result = await api.searchStream(customer_id, query);
        await client.logAction("ads_google_get_performance_report", { customer_id, date_range });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    }
  );

  // ─── WRITE TOOLS ──────────────────────────────────────────────────────

  server.tool(
    "ads_google_create_campaign",
    "Create a new campaign in Google Ads. Campaign will be created in PAUSED status for safety.",
    {
      customer_id: z.string().describe("Google Ads customer ID (without dashes)"),
      name: z.string().describe("Campaign name"),
      campaign_type: z.string().describe("Campaign type, e.g. 'SEARCH', 'DISPLAY', 'SHOPPING'"),
      daily_budget_micros: z.number().describe("Daily budget in micros (1 USD = 1,000,000 micros)"),
      bidding_strategy: z.string().describe("Bidding strategy type, e.g. 'MAXIMIZE_CLICKS', 'TARGET_CPA', 'MANUAL_CPC'"),
    },
    async ({ customer_id, name, campaign_type, daily_budget_micros, bidding_strategy }) => {
      try {
        await budgetGate(client, daily_budget_micros / MICROS_TO_CENTS);

        const token = await client.getCredential("google_ads");
        const api = new GoogleAdsClient(token, getDeveloperToken());

        // Create budget first
        const budgetResult = await api.mutate(customer_id, "campaignBudgets", [
          {
            create: {
              name: `${name} Budget`,
              amountMicros: String(daily_budget_micros),
              deliveryMethod: "STANDARD",
            },
          },
        ]) as { results?: Array<{ resourceName?: string }> };

        const budgetResourceName = budgetResult.results?.[0]?.resourceName;

        // Create campaign
        const result = await api.mutate(customer_id, "campaigns", [
          {
            create: {
              name,
              status: "PAUSED",
              advertisingChannelType: campaign_type,
              campaignBudget: budgetResourceName,
              [getBiddingStrategyField(bidding_strategy)]: {},
            },
          },
        ]);

        await client.logAction("ads_google_create_campaign", {
          customer_id,
          name,
          campaign_type,
          daily_budget_micros,
          bidding_strategy,
        });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "ads_google_update_campaign",
    "Update an existing Google Ads campaign. Budget gate enforced if budget is changed.",
    {
      customer_id: z.string().describe("Google Ads customer ID (without dashes)"),
      campaign_id: z.string().regex(/^\d+$/, "Campaign ID must be numeric").describe("Campaign ID to update"),
      name: z.string().optional().describe("New campaign name"),
      status: z.enum(VALID_CAMPAIGN_STATUSES).optional().describe("New status"),
      daily_budget_micros: z.number().optional().describe("New daily budget in micros"),
    },
    async ({ customer_id, campaign_id, name, status, daily_budget_micros }) => {
      try {
        if (daily_budget_micros !== undefined) {
          await budgetGate(client, daily_budget_micros / MICROS_TO_CENTS);
        }

        const token = await client.getCredential("google_ads");
        const api = new GoogleAdsClient(token, getDeveloperToken());

        const campaignResourceName = `customers/${customer_id}/campaigns/${campaign_id}`;
        const updateFields: Record<string, unknown> = {
          resourceName: campaignResourceName,
        };
        const updateMask: string[] = [];

        if (name !== undefined) {
          updateFields.name = name;
          updateMask.push("name");
        }
        if (status !== undefined) {
          updateFields.status = status;
          updateMask.push("status");
        }

        const result = await api.mutate(customer_id, "campaigns", [
          {
            update: updateFields,
            updateMask: updateMask.join(","),
          },
        ]);

        // Update budget separately if needed
        if (daily_budget_micros !== undefined) {
          // Fetch current budget resource name
          const budgetQuery = await api.searchStream(
            customer_id,
            `SELECT campaign.campaign_budget FROM campaign WHERE campaign.id = ${campaign_id}`
          ) as Array<{ results?: Array<{ campaign?: { campaignBudget?: string } }> }>;

          const budgetResource = (budgetQuery as any)?.[0]?.results?.[0]?.campaign?.campaignBudget;
          if (budgetResource) {
            await api.mutate(customer_id, "campaignBudgets", [
              {
                update: {
                  resourceName: budgetResource,
                  amountMicros: String(daily_budget_micros),
                },
                updateMask: "amount_micros",
              },
            ]);
          }
        }

        await client.logAction("ads_google_update_campaign", { customer_id, campaign_id, name, status, daily_budget_micros });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "ads_google_create_ad_group",
    "Create a new ad group in Google Ads. Ad group will be created in PAUSED status for safety.",
    {
      customer_id: z.string().describe("Google Ads customer ID (without dashes)"),
      campaign_id: z.string().regex(/^\d+$/, "Campaign ID must be numeric").describe("Parent campaign ID"),
      name: z.string().describe("Ad group name"),
      cpc_bid_micros: z.number().optional().describe("CPC bid in micros (1 USD = 1,000,000 micros)"),
    },
    async ({ customer_id, campaign_id, name, cpc_bid_micros }) => {
      try {
        await budgetGate(client, 0);

        const token = await client.getCredential("google_ads");
        const api = new GoogleAdsClient(token, getDeveloperToken());

        const adGroup: Record<string, unknown> = {
          name,
          status: "PAUSED",
          campaign: `customers/${customer_id}/campaigns/${campaign_id}`,
        };
        if (cpc_bid_micros !== undefined) {
          adGroup.cpcBidMicros = String(cpc_bid_micros);
        }

        const result = await api.mutate(customer_id, "adGroups", [
          { create: adGroup },
        ]);

        await client.logAction("ads_google_create_ad_group", { customer_id, campaign_id, name, cpc_bid_micros });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "ads_google_create_responsive_search_ad",
    "Create a responsive search ad in a Google Ads ad group",
    {
      customer_id: z.string().describe("Google Ads customer ID (without dashes)"),
      ad_group_id: z.string().describe("Parent ad group ID"),
      headlines: z.array(z.string()).min(3).max(15).describe("3-15 headline texts (max 30 chars each)"),
      descriptions: z.array(z.string()).min(2).max(4).describe("2-4 description texts (max 90 chars each)"),
      final_urls: z.array(z.string().url()).min(1).describe("Landing page URLs"),
    },
    async ({ customer_id, ad_group_id, headlines, descriptions, final_urls }) => {
      try {
        await budgetGate(client, 0);

        const token = await client.getCredential("google_ads");
        const api = new GoogleAdsClient(token, getDeveloperToken());

        const result = await api.mutate(customer_id, "adGroupAds", [
          {
            create: {
              adGroup: `customers/${customer_id}/adGroups/${ad_group_id}`,
              status: "PAUSED",
              ad: {
                responsiveSearchAd: {
                  headlines: headlines.map((text) => ({ text })),
                  descriptions: descriptions.map((text) => ({ text })),
                },
                finalUrls: final_urls,
              },
            },
          },
        ]);

        await client.logAction("ads_google_create_responsive_search_ad", {
          customer_id,
          ad_group_id,
          headline_count: headlines.length,
          description_count: descriptions.length,
        });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    }
  );

  server.tool(
    "ads_google_add_negative_keywords",
    "Add negative keywords to a Google Ads campaign to exclude unwanted search terms",
    {
      customer_id: z.string().describe("Google Ads customer ID (without dashes)"),
      campaign_id: z.string().regex(/^\d+$/, "Campaign ID must be numeric").describe("Campaign ID to add negative keywords to"),
      keywords: z.array(z.string()).min(1).describe("Negative keyword texts"),
      match_type: z.string().optional().describe("Match type: 'BROAD', 'PHRASE', 'EXACT'. Defaults to 'BROAD'"),
    },
    async ({ customer_id, campaign_id, keywords, match_type }) => {
      try {
        await budgetGate(client, 0);

        const token = await client.getCredential("google_ads");
        const api = new GoogleAdsClient(token, getDeveloperToken());

        const operations = keywords.map((keyword) => ({
          create: {
            campaign: `customers/${customer_id}/campaigns/${campaign_id}`,
            keyword: {
              text: keyword,
              matchType: match_type ?? "BROAD",
            },
          },
        }));

        const result = await api.mutate(
          customer_id,
          "campaignCriteria",
          operations
        );

        await client.logAction("ads_google_add_negative_keywords", {
          customer_id,
          campaign_id,
          keyword_count: keywords.length,
          match_type: match_type ?? "BROAD",
        });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
      }
    }
  );
}

/** Maps a bidding strategy name to its Google Ads API field name. */
function getBiddingStrategyField(strategy: string): string {
  const map: Record<string, string> = {
    MAXIMIZE_CLICKS: "maximizeClicks",
    MAXIMIZE_CONVERSIONS: "maximizeConversions",
    MAXIMIZE_CONVERSION_VALUE: "maximizeConversionValue",
    TARGET_CPA: "targetCpa",
    TARGET_ROAS: "targetRoas",
    TARGET_SPEND: "targetSpend",
    TARGET_IMPRESSION_SHARE: "targetImpressionShare",
    MANUAL_CPC: "manualCpc",
    MANUAL_CPM: "manualCpm",
  };
  return map[strategy] ?? "maximizeClicks";
}
