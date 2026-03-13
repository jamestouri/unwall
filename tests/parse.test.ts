import { describe, it, expect } from "vitest";
import { parseFlags, requireFlag, safeJsonParse } from "../src/cli/parse.js";

describe("parseFlags", () => {
  it("parses --key value pairs", () => {
    const result = parseFlags(["--account", "123", "--name", "test"]);
    expect(result).toEqual({ account: "123", name: "test" });
  });

  it("handles boolean flags with no value", () => {
    const result = parseFlags(["--verbose", "--account", "123"]);
    expect(result).toEqual({ verbose: "true", account: "123" });
  });

  it("handles boolean flag at end of args", () => {
    const result = parseFlags(["--account", "123", "--dry-run"]);
    expect(result).toEqual({ account: "123", "dry-run": "true" });
  });

  it("ignores non-flag arguments", () => {
    const result = parseFlags(["campaigns", "list", "--account", "123"]);
    expect(result).toEqual({ account: "123" });
  });

  it("returns empty object for no flags", () => {
    const result = parseFlags([]);
    expect(result).toEqual({});
  });
});

describe("requireFlag", () => {
  it("returns the flag value when present", () => {
    const flags = { account: "123", name: "test" };
    expect(requireFlag(flags, "account")).toBe("123");
  });

  it("throws on missing flag with helpful message", () => {
    const flags = { account: "123" };
    expect(() => requireFlag(flags, "name")).toThrow("Missing required flag: --name");
  });
});

describe("safeJsonParse", () => {
  it("returns parsed JSON", () => {
    const result = safeJsonParse('{"key": "value"}', "data");
    expect(result).toEqual({ key: "value" });
  });

  it("parses arrays", () => {
    const result = safeJsonParse('["a", "b"]', "items");
    expect(result).toEqual(["a", "b"]);
  });

  it("throws on invalid JSON with flag name in message", () => {
    expect(() => safeJsonParse("not-json", "targeting")).toThrow(
      "Invalid JSON for --targeting"
    );
  });
});
