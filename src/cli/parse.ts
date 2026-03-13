export function parseFlags(argv: string[]): Record<string, string> {
  const flags: Record<string, string> = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = "true";
      }
    }
  }

  return flags;
}

export function requireFlag(
  flags: Record<string, string>,
  name: string
): string {
  const value = flags[name];
  if (value === undefined) {
    throw new Error(`Missing required flag: --${name}`);
  }
  return value;
}

export function safeJsonParse(input: string, flagName: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    throw new Error(`Invalid JSON for --${flagName}: ${input}`);
  }
}
