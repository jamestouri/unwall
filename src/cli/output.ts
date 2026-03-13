export function success(data: unknown): void {
  process.stdout.write(JSON.stringify(data, null, 2) + "\n");
}

export function error(message: string): never {
  process.stderr.write(JSON.stringify({ error: message }, null, 2) + "\n");
  process.exit(1);
}
