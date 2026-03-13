import { UnwallClient } from "../../core/unwall-client.js";
import { budgetGate } from "../../core/budget-gate.js";
import { safeJsonParse } from "../parse.js";
import { MetaAdsClient } from "../../platforms/ads/meta/client.js";

export async function handleMeta(
  client: UnwallClient,
  resource: string,
  action: string,
  flags: Record<string, string>
): Promise<unknown> {
  const token = await client.getCredential("meta_ads");
  const api = new MetaAdsClient(token);

  const route = `${resource} ${action}`;

  switch (route) {
    // ─── Campaigns ──────────────────────────────────────────────────────

    case "campaigns list": {
      const result = await api.listCampaigns(flags.account, {
        limit: flags.limit ? Number(flags.limit) : undefined,
        status: flags.status ? flags.status.split(",") : undefined,
      });
      await client.logAction("meta_campaigns_list", { account: flags.account });
      return result;
    }

    case "campaigns create": {
      const budget = Number(flags["daily-budget"] || flags["lifetime-budget"] || 0);
      await budgetGate(client, budget);

      const result = await api.createCampaign(flags.account, {
        name: flags.name,
        objective: flags.objective,
        status: "PAUSED",
        ...(flags["daily-budget"] && { daily_budget: flags["daily-budget"] }),
        ...(flags["lifetime-budget"] && { lifetime_budget: flags["lifetime-budget"] }),
        special_ad_categories: flags["special-ad-categories"]
          ? flags["special-ad-categories"].split(",")
          : [],
      });
      await client.logAction("meta_campaigns_create", {
        account: flags.account,
        name: flags.name,
      });
      return result;
    }

    case "campaigns update": {
      const updates: Record<string, unknown> = {};
      if (flags.name) updates.name = flags.name;
      if (flags.status) updates.status = flags.status;
      if (flags["daily-budget"]) {
        updates.daily_budget = Number(flags["daily-budget"]);
        await budgetGate(client, updates.daily_budget as number);
      }
      if (flags["lifetime-budget"]) {
        updates.lifetime_budget = Number(flags["lifetime-budget"]);
        await budgetGate(client, updates.lifetime_budget as number);
      }

      const result = await api.updateCampaign(flags.id, updates);
      await client.logAction("meta_campaigns_update", { campaign_id: flags.id });
      return result;
    }

    // ─── Ad Sets ────────────────────────────────────────────────────────

    case "adsets list": {
      const result = await api.listAdSets(flags.account, {
        campaignId: flags["campaign-id"],
        limit: flags.limit ? Number(flags.limit) : undefined,
      });
      await client.logAction("meta_adsets_list", { account: flags.account });
      return result;
    }

    case "adsets create": {
      const budget = Number(flags["daily-budget"] || 0);
      await budgetGate(client, budget);

      const targeting = flags.targeting
        ? safeJsonParse(flags.targeting, "targeting")
        : {};

      const result = await api.createAdSet(flags.account, {
        campaign_id: flags["campaign-id"],
        name: flags.name,
        targeting,
        status: "PAUSED",
        daily_budget: flags["daily-budget"] ? Number(flags["daily-budget"]) : undefined,
        bid_amount: flags["bid-amount"] ? Number(flags["bid-amount"]) : undefined,
        optimization_goal: flags["optimization-goal"],
        billing_event: flags["billing-event"],
      });
      await client.logAction("meta_adsets_create", {
        account: flags.account,
        name: flags.name,
      });
      return result;
    }

    case "adsets update": {
      const updates: Record<string, unknown> = {};
      if (flags.name) updates.name = flags.name;
      if (flags.status) updates.status = flags.status;
      if (flags["daily-budget"]) {
        updates.daily_budget = Number(flags["daily-budget"]);
        await budgetGate(client, updates.daily_budget as number);
      }
      if (flags.targeting) updates.targeting = safeJsonParse(flags.targeting, "targeting");
      if (flags["bid-amount"]) updates.bid_amount = Number(flags["bid-amount"]);

      const result = await api.updateAdSet(flags.id, updates);
      await client.logAction("meta_adsets_update", { adset_id: flags.id });
      return result;
    }

    // ─── Ads ────────────────────────────────────────────────────────────

    case "ads list": {
      const result = await api.listAds(flags.account, {
        adSetId: flags["adset-id"],
        limit: flags.limit ? Number(flags.limit) : undefined,
      });
      await client.logAction("meta_ads_list", { account: flags.account });
      return result;
    }

    case "ads create": {
      await budgetGate(client, 0);

      const creative = safeJsonParse(flags.creative, "creative");
      const result = await api.createAd(flags.account, {
        adset_id: flags["adset-id"],
        name: flags.name,
        creative,
        status: "PAUSED",
      });
      await client.logAction("meta_ads_create", {
        account: flags.account,
        name: flags.name,
      });
      return result;
    }

    case "ads update": {
      const updates: Record<string, unknown> = {};
      if (flags.name) updates.name = flags.name;
      if (flags.status) updates.status = flags.status;
      if (flags.creative) updates.creative = safeJsonParse(flags.creative, "creative");

      const result = await api.updateAd(flags.id, updates);
      await client.logAction("meta_ads_update", { ad_id: flags.id });
      return result;
    }

    // ─── Insights ───────────────────────────────────────────────────────

    case "insights get": {
      const result = await api.getInsights(flags["object-id"], {
        date_preset: flags["date-preset"],
        time_range: flags["time-range"]
          ? (safeJsonParse(flags["time-range"], "time-range") as { since: string; until: string })
          : undefined,
        breakdowns: flags.breakdowns,
        fields: flags.fields,
      });
      await client.logAction("meta_insights_get", { object_id: flags["object-id"] });
      return result;
    }

    // ─── Audiences ──────────────────────────────────────────────────────

    case "audiences list": {
      const result = await api.listAudiences(flags.account);
      await client.logAction("meta_audiences_list", { account: flags.account });
      return result;
    }

    // ─── Images ─────────────────────────────────────────────────────────

    case "images upload": {
      await budgetGate(client, 0);

      const result = await api.uploadImage(flags.account, flags.url);
      await client.logAction("meta_images_upload", { account: flags.account });
      return result;
    }

    default:
      throw new Error(`Unknown Meta command: ${resource} ${action}`);
  }
}
