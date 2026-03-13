# unwall

**One token. All platforms. Real budget enforcement. Free.**

A CLI + MCP server that gives AI agents such as OpenClaw, and more — access to paid services through a single [Unwall](https://unwall.xyz) wallet. Manage ads across Meta, Google, and X today; LLMs, data APIs, and compute tomorrow.

## Why

- **Free** — no per-call fees, no monthly subscription
- **One token** — `UNWALL_TOKEN` replaces scattered API keys across Meta, Google, X
- **Hard budget enforcement** — Formance ledger rejects overspend; no markdown "guardrails" an LLM can ignore
- **Campaigns created PAUSED** — nothing goes live without explicit activation
- **Audit trail** — every tool call logged to a double-entry ledger

## Quick Start

### CLI (primary)

```bash
# Check what's connected
npx unwall status

# List Meta campaigns
npx unwall meta campaigns list --account 123456

# Create a Google Ads campaign (PAUSED by default)
npx unwall google campaigns create --customer 9876543210 --name "Summer Sale" --campaign-type SEARCH --daily-budget-micros 5000000 --bidding-strategy MAXIMIZE_CLICKS

# Get X Ads analytics
npx unwall x analytics get --account abc --entity CAMPAIGN --entity-ids id1,id2 --start-time 2026-01-01 --end-time 2026-03-01
```

### MCP Server

Works with any MCP-compatible client — Claude Code, OpenClaw and others

```bash
npx unwall serve
```

Add to your MCP client config:

```json
{
  "mcpServers": {
    "unwall": {
      "command": "npx",
      "args": ["unwall", "serve"],
      "env": { "UNWALL_TOKEN": "sk_proj_xxx" }
    }
  }
}
```

Get your project token at [unwall.xyz](https://unwall.xyz).

## CLI Commands

```
unwall status                                    # Connected platforms + balance
unwall balance                                   # Wallet balance
unwall serve                                     # Start MCP server

unwall meta campaigns list --account <id>        # Meta Ads
unwall meta campaigns create --account <id> --name <name> --objective <obj>
unwall meta adsets list --account <id>
unwall meta ads list --account <id>
unwall meta insights get --object-id <id>
unwall meta audiences list --account <id>

unwall google campaigns list --customer <id>     # Google Ads
unwall google campaigns create --customer <id> --name <name> --campaign-type SEARCH
unwall google adgroups list --customer <id>
unwall google keywords research --customer <id> --keywords "shoes,sneakers"
unwall google report get --customer <id> --date-range LAST_30_DAYS

unwall x campaigns list --account <id>           # X Ads
unwall x campaigns create --account <id> --data '{"name":"...","funding_instrument_id":"..."}'
unwall x line-items list --account <id>
unwall x analytics get --account <id> --entity CAMPAIGN --entity-ids id1
unwall x audiences list --account <id>
```

All output is JSON — pipe to `jq` or let your agent parse it directly.

## MCP Tools (29 total)

When running as an MCP server (via OpenClaw, Claude Code, Cursor, etc.), only tools for your connected platforms appear. Connect platforms at [unwall.xyz/dashboard](https://unwall.xyz/dashboard).

### Meta Ads (12 tools)

| Tool | Type | Description |
|------|------|-------------|
| `ads_meta_list_campaigns` | read | List campaigns with optional status filtering |
| `ads_meta_list_adsets` | read | List ad sets, optionally filtered by campaign |
| `ads_meta_list_ads` | read | List ads, optionally filtered by ad set |
| `ads_meta_get_insights` | read | Get performance insights for any ad object |
| `ads_meta_list_audiences` | read | List custom audiences |
| `ads_meta_create_campaign` | write | Create a campaign (PAUSED by default) |
| `ads_meta_update_campaign` | write | Update campaign name, status, or budget |
| `ads_meta_create_adset` | write | Create an ad set (PAUSED by default) |
| `ads_meta_update_adset` | write | Update ad set targeting, budget, or status |
| `ads_meta_create_ad` | write | Create an ad (PAUSED by default) |
| `ads_meta_update_ad` | write | Update ad creative or status |
| `ads_meta_upload_image` | write | Upload an image from URL |

### Google Ads (9 tools)

| Tool | Type | Description |
|------|------|-------------|
| `ads_google_list_campaigns` | read | List campaigns with optional status filtering |
| `ads_google_list_ad_groups` | read | List ad groups, optionally filtered by campaign |
| `ads_google_keyword_research` | read | Generate keyword ideas from seed keywords |
| `ads_google_get_performance_report` | read | Get performance metrics with custom date ranges |
| `ads_google_create_campaign` | write | Create a campaign (PAUSED by default) |
| `ads_google_update_campaign` | write | Update campaign name, status, or budget |
| `ads_google_create_ad_group` | write | Create an ad group (PAUSED by default) |
| `ads_google_create_responsive_search_ad` | write | Create a responsive search ad |
| `ads_google_add_negative_keywords` | write | Add negative keywords to a campaign |

### X Ads (8 tools)

| Tool | Type | Description |
|------|------|-------------|
| `ads_x_list_campaigns` | read | List campaigns with optional status filtering |
| `ads_x_list_line_items` | read | List line items, optionally filtered by campaign |
| `ads_x_get_analytics` | read | Get analytics for campaigns, line items, or tweets |
| `ads_x_list_audiences` | read | List tailored audiences |
| `ads_x_create_campaign` | write | Create a campaign (PAUSED by default) |
| `ads_x_update_campaign` | write | Update campaign name, status, or budget |
| `ads_x_create_line_item` | write | Create a line item (PAUSED by default) |
| `ads_x_create_promoted_tweet` | write | Promote a tweet through a line item |

## Architecture

```
MCP Client (OpenClaw / Claude Code / Cursor / any MCP host)
  │
  ├── CLI commands             ─── unwall meta campaigns list
  ├── MCP protocol             ─── unwall serve
  │
  ▼
unwall (TypeScript, runs locally)
  │
  ├── Auth: sk_proj_xxx → Unwall API → per-platform OAuth tokens
  ├── Budget gate: hard balance + limit check before write tools
  ├── Audit: every tool call logged to Formance ledger
  │
  ├──► Meta Marketing API (Graph API v22)
  ├──► Google Ads API (REST v18)
  └──► X Ads API (v12)
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `UNWALL_TOKEN` | Yes | Your Unwall project token (`sk_proj_xxx`) |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | For Google | Google Ads API developer token |

## Development

```bash
git clone https://github.com/unwall-xyz/unwall.git
cd unwall
npm install
npm run build
UNWALL_TOKEN=sk_proj_xxx npm start
```

## Contributing

Contributions welcome. Please keep changes focused and test before submitting.

## License

MIT
