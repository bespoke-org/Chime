import { existsSync, readFileSync } from "node:fs";

import { defineConfig, env } from "prisma/config";

// Prisma 7 no longer reads .env on its own. Load it for the CLI when the
// shell has not exported DATABASE_URL, so `bun install` and `bun run prisma:*`
// work from a fresh checkout.
if (!process.env.DATABASE_URL && existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);

    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    const value = rawValue.replace(/^(["'])(.*)\1$/, "$2");

    process.env[key] ??= value;
  }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
