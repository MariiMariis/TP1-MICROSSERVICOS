// /api/medical-records/analytics - runs the aggregation pipelines from the catalog.
import { Router } from "express";
import { getDb, records } from "../db.js";
import { ANALYTICS } from "../pipelines/analytics.js";
import { digestExplain } from "../explain.js";
import { badRequest, notFound } from "../errors.js";

export const analyticsRouter = Router();

const DASHBOARD_KEYS = ["kpis", "ageGroups", "encountersByMonth", "topDiagnoses", "specialties", "topMedications", "healthPlans", "bmi", "allergyConflicts", "topPatients", "severeAllergies", "fieldsBySpecialty"];

function parseParams(spec, query) {
  const params = {};
  for (const name of spec.params || []) {
    if (query[name] === undefined) throw badRequest(`Required parameter: ${name}`);
    params[name] = name.endsWith("Id") ? Number(query[name]) : String(query[name]);
  }
  return params;
}

export async function runAnalytics(key, query = {}) {
  const spec = ANALYTICS[key];
  if (!spec) throw notFound(`Analysis '${key}' does not exist`);
  const pipeline = spec.stages(parseParams(spec, query));
  const started = Date.now();
  const result = await getDb().collection(spec.collection).aggregate(pipeline, { allowDiskUse: true }).toArray();
  return { key, title: spec.title, description: spec.description ?? null, collection: spec.collection, pipeline, tookMs: Date.now() - started, result: key === "kpis" ? result[0] : result };
}

analyticsRouter.get("/", (req, res) => {
  res.json(Object.entries(ANALYTICS).map(([key, spec]) => ({ key, title: spec.title, description: spec.description ?? null, collection: spec.collection, params: spec.params ?? [] })));
});

analyticsRouter.get("/dashboard", async (req, res) => {
  const started = Date.now();
  const [totalPatients, ...reports] = await Promise.all([
    records().countDocuments(),
    ...DASHBOARD_KEYS.map((key) => runAnalytics(key, req.query)),
  ]);
  const byKey = Object.fromEntries(reports.map((r) => [r.key, r]));
  res.json({ generatedAt: new Date(), tookMs: Date.now() - started, totalPatients, reports: byKey });
});

// "How Atlas processed it": runs the same pipeline with explain("executionStats") and returns
// the per-stage digest (index or scan, documents read, time, cluster node that executed it).
analyticsRouter.get("/:key/explain", async (req, res) => {
  const spec = ANALYTICS[req.params.key];
  if (!spec) throw notFound(`Analysis '${req.params.key}' does not exist`);
  const pipeline = spec.stages(parseParams(spec, req.query));
  const started = Date.now();
  // Raw command: the aggregate(...).explain() shortcut would inherit the writeConcern from the
  // connection string (w=majority), and the server refuses explain with a writeConcern.
  const raw = await getDb().command({ explain: { aggregate: spec.collection, pipeline, cursor: {}, allowDiskUse: true }, verbosity: "executionStats" });
  const digest = digestExplain(raw);
  res.json({ key: req.params.key, title: spec.title, collection: spec.collection, pipeline, roundTripMs: Date.now() - started, ...digest, raw });
});

analyticsRouter.get("/:key", async (req, res) => {
  res.json(await runAnalytics(req.params.key, req.query));
});
