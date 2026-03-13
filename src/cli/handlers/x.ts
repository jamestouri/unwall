import { UnwallClient } from "../../core/unwall-client.js";
import { budgetGate } from "../../core/budget-gate.js";
import { safeJsonParse } from "../parse.js";
import { XAdsClient } from "../../platforms/ads/x/client.js";

export async function handleX(
  client: UnwallClient,
  resource: string,
  action: string,
  flags: Record<string, string>
): Promise<unknown> {
  const token = await client.getCredential("x_ads");
  const api = new XAdsClient(token);

  const route = `${resource} ${action}`;

  switch (route) {
    // ─── Campaigns ──────────────────────────────────────────────────────

    case "campaigns list": {
      const result = await api.listCampaigns(flags.account);
      await client.logAction("x_campaigns_list", { account: flags.account });
      return result;
    }

    case "campaigns create": {
      const data = safeJsonParse(flags.data, "data") as Record<string, unknown>;
      const budget = Number(data.daily_budget_amount_local_micro || 0);
      await budgetGate(client, budget / 10000);

      data.entity_status = "PAUSED";
      const result = await api.createCampaign(flags.account, data);
      await client.logAction("x_campaigns_create", {
        account: flags.account,
      });
      return result;
    }

    case "campaigns update": {
      const data = safeJsonParse(flags.data, "data") as Record<string, unknown>;
      if (data.daily_budget_amount_local_micro) {
        await budgetGate(
          client,
          Number(data.daily_budget_amount_local_micro) / 10000
        );
      }

      const result = await api.updateCampaign(flags.account, flags.id, data);
      await client.logAction("x_campaigns_update", {
        account: flags.account,
        campaign_id: flags.id,
      });
      return result;
    }

    // ─── Line Items ─────────────────────────────────────────────────────

    case "line-items list": {
      const result = await api.listLineItems(flags.account, flags["campaign-id"]);
      await client.logAction("x_line_items_list", {
        account: flags.account,
      });
      return result;
    }

    case "line-items create": {
      const data = safeJsonParse(flags.data, "data") as Record<string, unknown>;
      const budget = Number(data.bid_amount_local_micro || 0);
      await budgetGate(client, budget / 10000);

      data.entity_status = "PAUSED";
      const result = await api.createLineItem(flags.account, data);
      await client.logAction("x_line_items_create", {
        account: flags.account,
      });
      return result;
    }

    // ─── Promoted Tweets ────────────────────────────────────────────────

    case "promoted-tweets create": {
      await budgetGate(client, 0);

      const data = safeJsonParse(flags.data, "data") as Record<string, unknown>;
      const result = await api.createPromotedTweet(flags.account, data);
      await client.logAction("x_promoted_tweets_create", {
        account: flags.account,
      });
      return result;
    }

    // ─── Analytics ──────────────────────────────────────────────────────

    case "analytics get": {
      const entityIds = flags["entity-ids"].split(",");
      const metricGroups = flags["metric-groups"]
        ? flags["metric-groups"].split(",")
        : undefined;

      const result = await api.getAnalytics(flags.account, {
        entity: flags.entity,
        entity_ids: entityIds,
        start_time: flags["start-time"],
        end_time: flags["end-time"],
        granularity: flags.granularity,
        metric_groups: metricGroups,
      });
      await client.logAction("x_analytics_get", {
        account: flags.account,
        entity: flags.entity,
      });
      return result;
    }

    // ─── Audiences ──────────────────────────────────────────────────────

    case "audiences list": {
      const result = await api.listAudiences(flags.account);
      await client.logAction("x_audiences_list", { account: flags.account });
      return result;
    }

    default:
      throw new Error(`Unknown X command: ${resource} ${action}`);
  }
}
