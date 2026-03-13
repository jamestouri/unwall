import { describe, it, expect, vi } from "vitest";
import { budgetGate } from "../src/core/budget-gate.js";
import type { UnwallClient } from "../src/core/unwall-client.js";

function mockClient(balance: {
  available: number;
  total_spent: number;
  budget_limit: number | null;
  currency: string;
}): UnwallClient {
  return {
    getBalance: vi.fn().mockResolvedValue(balance),
  } as unknown as UnwallClient;
}

describe("budgetGate", () => {
  it("passes when balance is sufficient", async () => {
    const client = mockClient({
      available: 5000,
      total_spent: 1000,
      budget_limit: null,
      currency: "USD",
    });

    await expect(budgetGate(client, 2000)).resolves.toBeUndefined();
  });

  it("throws when balance is insufficient", async () => {
    const client = mockClient({
      available: 500,
      total_spent: 9500,
      budget_limit: null,
      currency: "USD",
    });

    await expect(budgetGate(client, 1000)).rejects.toThrow(
      "Insufficient balance"
    );
  });

  it("throws when budget limit would be exceeded", async () => {
    const client = mockClient({
      available: 5000,
      total_spent: 9000,
      budget_limit: 10000,
      currency: "USD",
    });

    await expect(budgetGate(client, 2000)).rejects.toThrow(
      "Would exceed budget limit"
    );
  });

  it("passes when budget_limit is null (no limit set)", async () => {
    const client = mockClient({
      available: 5000,
      total_spent: 50000,
      budget_limit: null,
      currency: "USD",
    });

    await expect(budgetGate(client, 1000)).resolves.toBeUndefined();
  });

  it("passes with zero cost", async () => {
    const client = mockClient({
      available: 0,
      total_spent: 10000,
      budget_limit: 10000,
      currency: "USD",
    });

    await expect(budgetGate(client, 0)).resolves.toBeUndefined();
  });

  it("includes dollar amounts in error messages", async () => {
    const client = mockClient({
      available: 150,
      total_spent: 9850,
      budget_limit: null,
      currency: "USD",
    });

    await expect(budgetGate(client, 500)).rejects.toThrow("$1.50 available");
  });
});
