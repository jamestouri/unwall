#!/usr/bin/env node

import { Command } from "commander";
import { startServer } from "./serve.js";
import { success, error } from "./cli/output.js";
import { statusCommand, balanceCommand } from "./cli/status.js";
import { handleMeta } from "./cli/handlers/meta.js";
import { handleGoogle } from "./cli/handlers/google.js";
import { handleX } from "./cli/handlers/x.js";
import { UnwallClient } from "./core/unwall-client.js";
import { parseFlags } from "./cli/parse.js";

function getToken(): string {
  const token = process.env.UNWALL_TOKEN;
  if (!token) {
    error("UNWALL_TOKEN is required. Get your project token at https://unwall.xyz");
  }
  return token;
}

async function runPlatformHandler(
  platform: string,
  args: string[]
): Promise<void> {
  const resource = args[0];
  const action = args[1];

  if (!resource || !action) {
    error(`Usage: unwall ${platform} <resource> <action> [--flags]`);
  }

  const flags = parseFlags(args.slice(2));
  const token = getToken();
  const client = new UnwallClient(token);

  try {
    let result: unknown;
    switch (platform) {
      case "meta":
        result = await handleMeta(client, resource, action, flags);
        break;
      case "google":
        result = await handleGoogle(client, resource, action, flags);
        break;
      case "x":
        result = await handleX(client, resource, action, flags);
        break;
      default:
        error(`Unknown platform: ${platform}`);
    }
    success(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    error(message);
  }
}

// ─── CLI Definition ──────────────────────────────────────────────────────────

const program = new Command()
  .name("unwall")
  .description("CLI + MCP server for AI agents to manage ads across Meta, Google, and X")
  .version("0.1.0");

program
  .command("serve")
  .description("Start MCP server")
  .action(async () => {
    const token = getToken();
    await startServer(token);
  });

program
  .command("status")
  .description("Show connected platforms and wallet balance")
  .action(async () => {
    const token = getToken();
    await statusCommand(token);
  });

program
  .command("balance")
  .description("Show wallet balance")
  .action(async () => {
    const token = getToken();
    await balanceCommand(token);
  });

program
  .command("meta")
  .description("Meta Ads commands")
  .allowUnknownOption()
  .argument("<args...>", "resource action [--flags]")
  .action(async (args: string[]) => {
    await runPlatformHandler("meta", args);
  });

program
  .command("google")
  .description("Google Ads commands")
  .allowUnknownOption()
  .argument("<args...>", "resource action [--flags]")
  .action(async (args: string[]) => {
    await runPlatformHandler("google", args);
  });

program
  .command("x")
  .description("X Ads commands")
  .allowUnknownOption()
  .argument("<args...>", "resource action [--flags]")
  .action(async (args: string[]) => {
    await runPlatformHandler("x", args);
  });

// Default to serve if no command given
if (process.argv.length <= 2) {
  const token = getToken();
  await startServer(token);
} else {
  program.parse();
}
