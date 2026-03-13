import type { UnwallClient } from "./unwall-client.js";

export async function budgetGate(
  client: UnwallClient,
  estimatedCost: number
): Promise<void> {
  const balance = await client.getBalance();

  if (balance.available < estimatedCost) {
    throw new Error(
      `Insufficient balance: $${(balance.available / 100).toFixed(2)} available, ` +
        `$${(estimatedCost / 100).toFixed(2)} required`
    );
  }

  if (
    balance.budget_limit !== null &&
    balance.total_spent + estimatedCost > balance.budget_limit
  ) {
    throw new Error(
      `Would exceed budget limit of $${(balance.budget_limit / 100).toFixed(2)} ` +
        `(spent: $${(balance.total_spent / 100).toFixed(2)}, ` +
        `requested: $${(estimatedCost / 100).toFixed(2)})`
    );
  }
}
