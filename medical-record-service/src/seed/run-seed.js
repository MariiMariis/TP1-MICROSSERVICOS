// CLI: node src/seed/run-seed.js [--force]
import { close, connect, ensureSchema, ensureSearchIndexes, serverInfo } from "../db.js";
import { seedDatabase } from "./seed.js";

const force = process.argv.includes("--force");

try {
  await connect();
  console.log("[seed] connected:", await serverInfo());
  await ensureSchema();
  const result = await seedDatabase({ force });
  console.log("[seed] result:", result);
  console.log("[seed] Atlas Search indexes:", await ensureSearchIndexes());
} catch (err) {
  console.error("[seed] failed:", err);
  process.exitCode = 1;
} finally {
  await close();
}
