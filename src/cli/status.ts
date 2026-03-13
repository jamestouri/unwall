import { UnwallClient } from "../core/unwall-client.js";
import { success, error } from "./output.js";

export async function statusCommand(token: string): Promise<void> {
  try {
    const client = new UnwallClient(token);
    const [platforms, balance] = await Promise.all([
      client.getConnectedPlatforms(),
      client.getBalance(),
    ]);
    success({ platforms, balance });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    error(message);
  }
}

export async function balanceCommand(token: string): Promise<void> {
  try {
    const client = new UnwallClient(token);
    const balance = await client.getBalance();
    success(balance);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    error(message);
  }
}
