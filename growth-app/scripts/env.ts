// Reads ONE key from a dotenv file without loading the rest into the process.
import { readFileSync } from "node:fs";

export function readEnvKey(key: string, argv = process.argv): string | undefined {
  if (process.env[key]) return process.env[key];
  const i = argv.indexOf("--env-file");
  if (i < 0 || !argv[i + 1]) return undefined;
  for (const line of readFileSync(argv[i + 1], "utf8").split("\n")) {
    const t = line.trim();
    if (t.startsWith(`${key}=`)) return t.slice(key.length + 1).trim();
  }
  return undefined;
}
