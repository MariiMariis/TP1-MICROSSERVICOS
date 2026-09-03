// Initial load: 120 patient records + hundreds of heterogeneous encounters.
import { encounters, getDb, records } from "../db.js";
import { buildRecord, generateEncounters, loadPatients } from "./generate-encounters.js";

// Collections from the Portuguese version of the schema, dropped when reseeding.
const LEGACY_COLLECTIONS = ["prontuarios", "atendimentos"];

export async function seedDatabase({ force = false } = {}) {
  const existing = await records().countDocuments();
  if (existing > 0 && !force) {
    const total = await encounters().countDocuments();
    console.log(`[seed] database already populated (${existing} records, ${total} encounters). Seed skipped.`);
    return { skipped: true, records: existing, encounters: total };
  }

  if (force) {
    await records().deleteMany({});
    await encounters().deleteMany({});
    console.log("[seed] collections cleared (force)");
  }
  for (const name of LEGACY_COLLECTIONS) {
    const found = await getDb().listCollections({ name }).toArray();
    if (found.length) { await getDb().collection(name).drop(); console.log(`[seed] legacy collection ${name} dropped`); }
  }

  const patients = loadPatients();
  const generated = generateEncounters(patients);
  const docs = patients.map((p) => buildRecord(p, generated));

  const started = Date.now();
  const r1 = await records().insertMany(docs, { ordered: true });
  const r2 = await encounters().insertMany(generated, { ordered: true });
  const tookMs = Date.now() - started;

  const specialties = new Set(generated.map((e) => e.specialty));
  console.log(`[seed] ${r1.insertedCount} records and ${r2.insertedCount} encounters (${specialties.size} specialties) inserted in ${tookMs} ms`);
  return { skipped: false, records: r1.insertedCount, encounters: r2.insertedCount, specialties: [...specialties], tookMs };
}
