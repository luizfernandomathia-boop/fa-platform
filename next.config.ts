import type { NextConfig } from "next";
import { readFileSync } from "fs";
import { join } from "path";

// Force-load .env.local so that variables inherited from the shell
// (e.g. empty ANTHROPIC_API_KEY set by Claude Code CLI) are overridden.
try {
  const envFile = join(process.cwd(), ".env.local");
  const lines = readFileSync(envFile, "utf-8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (key && value) {
      process.env[key] = value;
    }
  }
} catch {
  // .env.local not found — no-op
}

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
