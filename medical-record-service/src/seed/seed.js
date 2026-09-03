// Carga inicial: 120 prontuarios + centenas de atendimentos heterogeneos.
import { atendimentos, prontuarios } from "../db.js";
import { buildProntuario, generateEncounters, loadPatients } from "./generate-encounters.js";

export async function seedDatabase({ force = false } = {}) {
  const existing = await prontuarios().countDocuments();
  if (existing > 0 && !force) {
    const encounters = await atendimentos().countDocuments();
    console.log(`[seed] banco ja populado (${existing} prontuarios, ${encounters} atendimentos). Seed ignorado.`);
    return { skipped: true, prontuarios: existing, atendimentos: encounters };
  }

  if (force) {
    await prontuarios().deleteMany({});
    await atendimentos().deleteMany({});
    console.log("[seed] colecoes limpas (force)");
  }

  const patients = loadPatients();
  const encounters = generateEncounters(patients);
  const docs = patients.map((p) => buildProntuario(p, encounters));

  const started = Date.now();
  const r1 = await prontuarios().insertMany(docs, { ordered: true });
  const r2 = await atendimentos().insertMany(encounters, { ordered: true });
  const tookMs = Date.now() - started;

  const specialties = new Set(encounters.map((e) => e.specialty));
  console.log(`[seed] ${r1.insertedCount} prontuarios e ${r2.insertedCount} atendimentos (${specialties.size} especialidades) inseridos em ${tookMs} ms`);
  return { skipped: false, prontuarios: r1.insertedCount, atendimentos: r2.insertedCount, especialidades: [...specialties], tookMs };
}
