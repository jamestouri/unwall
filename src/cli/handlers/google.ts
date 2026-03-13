import { UnwallClient } from "../../core/unwall-client.js";
import { budgetGate } from "../../core/budget-gate.js";
import { safeJsonParse } from "../parse.js";
import { GoogleAdsClient } from "../../platforms/ads/google/client.js";

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

export async function handleGoogle(
  client: UnwallClient,
  resource: string,
  action: string,
  flags: Record<string, string>
): Promise<unknown> {
  const token = await client.getCredential("google_ads");
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "";
  const api = new GoogleAdsClient(token, developerToken);

  const route = `${resource} ${action}`;

  switch (route) {
    // ─── Campaigns ──────────────────────────────────────────────────────

    case "campaigns list": {
      let query = `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, campaign.campaign_budget, campaign.start_date, campaign.end_date FROM campaign`;
      if (flags.status) {
        query += ` WHERE campaign.status = '${flags.status}'`;
      }

      const result = await api.searchStream(flags.customer, query);
      await client.logAction("google_campaigns_list", {
        customer_id: flags.customer,
      });
      return result;
    }

    case "campaigns create": {
      const budgetMicros = Number(flags["daily-budget-micros"]);
      await budgetGate(client, budgetMicros / 10000);

      // Create budget first
      const budgetResult = (await api.mutate(
        flags.customer,
        "campaignBudgets",
        [
          {
            create: {
              name: `${flags.name} Budget`,
              amountMicros: String(budgetMicros),
              deliveryMethod: "STANDARD",
            },
          },
        ]
      )) as { results?: Array<{ resourceName?: string }> };

      const budgetResourceName = budgetResult.results?.[0]?.resourceName;

      // Create campaign
      const result = await api.mutate(flags.customer, "campaigns", [
        {
          create: {
            name: flags.name,
            status: "PAUSED",
            advertisingChannelType: flags["campaign-type"],
            campaignBudget: budgetResourceName,
            [getBiddingStrategyField(flags["bidding-strategy"])]: {},
          },
        },
      ]);

      await client.logAction("google_campaigns_create", {
        customer_id: flags.customer,
        name: flags.name,
        campaign_type: flags["campaign-type"],
      });
      return result;
    }

    case "campaigns update": {
      if (flags["daily-budget-micros"]) {
        await budgetGate(client, Number(flags["daily-budget-micros"]) / 10000);
      }

      const campaignResourceName = `customers/${flags.customer}/campaigns/${flags["campaign-id"]}`;
      const updateFields: Record<string, unknown> = {
        resourceName: campaignResourceName,
      };
      const updateMask: string[] = [];

      if (flags.name) {
        updateFields.name = flags.name;
        updateMask.push("name");
      }
      if (flags.status) {
        updateFields.status = flags.status;
        updateMask.push("status");
      }

      const result = await api.mutate(flags.customer, "campaigns", [
        { update: updateFields, updateMask: updateMask.join(",") },
      ]);

      // Update budget separately if needed
      if (flags["daily-budget-micros"]) {
        const budgetQuery = await api.searchStream(
          flags.customer,
          `SELECT campaign.campaign_budget FROM campaign WHERE campaign.id = ${flags["campaign-id"]}`
        );

        const budgetResource = (budgetQuery as any)?.[0]?.results?.[0]
          ?.campaign?.campaignBudget;
        if (budgetResource) {
          await api.mutate(flags.customer, "campaignBudgets", [
            {
              update: {
                resourceName: budgetResource,
                amountMicros: String(flags["daily-budget-micros"]),
              },
              updateMask: "amount_micros",
            },
          ]);
        }
      }

      await client.logAction("google_campaigns_update", {
        customer_id: flags.customer,
        campaign_id: flags["campaign-id"],
      });
      return result;
    }

    // ─── Ad Groups ──────────────────────────────────────────────────────

    case "adgroups list": {
      let query = `SELECT ad_group.id, ad_group.name, ad_group.status, ad_group.campaign, ad_group.cpc_bid_micros, ad_group.type FROM ad_group`;
      if (flags["campaign-id"]) {
        query += ` WHERE campaign.id = ${flags["campaign-id"]}`;
      }

      const result = await api.searchStream(flags.customer, query);
      await client.logAction("google_adgroups_list", {
        customer_id: flags.customer,
      });
      return result;
    }

    case "adgroups create": {
      await budgetGate(client, 0);

      const adGroup: Record<string, unknown> = {
        name: flags.name,
        status: "PAUSED",
        campaign: `customers/${flags.customer}/campaigns/${flags["campaign-id"]}`,
      };
      if (flags["cpc-bid-micros"]) {
        adGroup.cpcBidMicros = String(flags["cpc-bid-micros"]);
      }

      const result = await api.mutate(flags.customer, "adGroups", [
        { create: adGroup },
      ]);

      await client.logAction("google_adgroups_create", {
        customer_id: flags.customer,
        name: flags.name,
      });
      return result;
    }

    // ─── Ads ────────────────────────────────────────────────────────────

    case "ads create": {
      await budgetGate(client, 0);

      const headlines = safeJsonParse(flags.headlines, "headlines") as string[];
      const descriptions = safeJsonParse(flags.descriptions, "descriptions") as string[];
      const finalUrls = safeJsonParse(flags["final-urls"], "final-urls") as string[];

      const result = await api.mutate(flags.customer, "adGroupAds", [
        {
          create: {
            adGroup: `customers/${flags.customer}/adGroups/${flags["ad-group-id"]}`,
            status: "PAUSED",
            ad: {
              responsiveSearchAd: {
                headlines: headlines.map((text) => ({ text })),
                descriptions: descriptions.map((text) => ({ text })),
              },
              finalUrls,
            },
          },
        },
      ]);

      await client.logAction("google_ads_create", {
        customer_id: flags.customer,
        ad_group_id: flags["ad-group-id"],
      });
      return result;
    }

    // ─── Keywords ───────────────────────────────────────────────────────

    case "keywords research": {
      const keywords = flags.keywords.split(",");
      const geoTargetConstants = flags["geo-targets"]
        ? flags["geo-targets"].split(",").map((g) => `geoTargetConstants/${g}`)
        : undefined;
      const language = flags["language-id"]
        ? `languageConstants/${flags["language-id"]}`
        : undefined;

      const result = await api.generateKeywordIdeas(flags.customer, {
        keywords,
        language,
        geoTargetConstants,
      });

      await client.logAction("google_keywords_research", {
        customer_id: flags.customer,
        keywords,
      });
      return result;
    }

    case "keywords negative": {
      await budgetGate(client, 0);

      const negativeKeywords = flags.keywords.split(",");
      const matchType = flags["match-type"] ?? "BROAD";

      const operations = negativeKeywords.map((keyword) => ({
        create: {
          campaign: `customers/${flags.customer}/campaigns/${flags["campaign-id"]}`,
          keyword: {
            text: keyword.trim(),
            matchType,
          },
        },
      }));

      const result = await api.mutate(
        flags.customer,
        "campaignCriteria",
        operations
      );

      await client.logAction("google_keywords_negative", {
        customer_id: flags.customer,
        campaign_id: flags["campaign-id"],
        keyword_count: negativeKeywords.length,
      });
      return result;
    }

    // ─── Reports ────────────────────────────────────────────────────────

    case "report get": {
      const metrics = flags.metrics
        ? flags.metrics.split(",").map((m) => `metrics.${m.trim()}`).join(", ")
        : "metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.ctr, metrics.average_cpc";

      const segments = flags.segments
        ? ", " + flags.segments.split(",").map((s) => `segments.${s.trim()}`).join(", ")
        : "";

      let dateClause: string;
      const dateRange = flags["date-range"];
      if (dateRange.includes(",")) {
        const [start, end] = dateRange.split(",");
        dateClause = `segments.date BETWEEN '${start.trim()}' AND '${end.trim()}'`;
      } else {
        dateClause = `segments.date DURING ${dateRange}`;
      }

      const query = `SELECT campaign.id, campaign.name, ${metrics}${segments} FROM campaign WHERE ${dateClause}`;

      const result = await api.searchStream(flags.customer, query);
      await client.logAction("google_report_get", {
        customer_id: flags.customer,
        date_range: dateRange,
      });
      return result;
    }

    default:
      throw new Error(`Unknown Google command: ${resource} ${action}`);
  }
}
