// CLI: node src/seed/run-seed.js [--force]
import { close, connect, ensureSchema, ensureSearchIndexes, serverInfo } from "../db.js";
import { seedDatabase } from "./seed.js";

const force = process.argv.includes("--force");

try {
  await connect();
  console.log("[seed] conectado:", await serverInfo());
  await ensureSchema();
  const result = await seedDatabase({ force });
  console.log("[seed] resultado:", result);
  console.log("[seed] indices do Atlas Search:", await ensureSearchIndexes());
} catch (err) {
  console.error("[seed] falhou:", err);
  process.exitCode = 1;
} finally {
  await close();
}
