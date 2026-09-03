// /api/medical-records/admin - MongoDB "behind the scenes" for the demo:
// explain plan with and without index, indexes, schema validation, statistics and seed.
import { Router } from "express";
import { EJSON } from "bson";
import { encounters, ensureSearchIndexes, getDb, INDEXES, isAtlas, records, searchState, serverInfo } from "../db.js";
import { COLLECTIONS } from "../config.js";
import { badRequest } from "../errors.js";
import { seedDatabase } from "../seed/seed.js";

export const adminRouter = Router();

adminRouter.get("/overview", async (req, res) => {
  const stats = async (name) => {
    const [s] = await getDb().collection(name).aggregate([{ $collStats: { storageStats: {}, count: {} } }]).toArray();
    const st = s.storageStats;
    return { collection: name, documents: s.count, dataKb: Math.round(st.size / 1024), avgObjectBytes: Math.round(st.avgObjSize || 0), storageKb: Math.round(st.storageSize / 1024), indexes: st.nindexes, indexesKb: Math.round(st.totalIndexSize / 1024) };
  };
  res.json({
    server: await serverInfo(),
    atlasSearch: searchState,
    collections: await Promise.all([stats(COLLECTIONS.records), stats(COLLECTIONS.encounters)]),
  });
});

adminRouter.get("/indexes", async (req, res) => {
  const result = {};
  for (const name of Object.values(COLLECTIONS)) {
    const list = await getDb().collection(name).indexes();
    result[name] = list.map((i) => ({ name: i.name, key: i.key, unique: Boolean(i.unique), type: Object.values(i.key).includes("2dsphere") ? "geospatial" : i.name === "_id_" ? "default" : Object.keys(i.key).length > 1 ? "compound" : "single field" }));
  }
  res.json({ declared: INDEXES, existing: result });
});

adminRouter.get("/schema", async (req, res) => {
  // listCollections only accepts an exact name or a regex in the filter; we filter here.
  const cols = (await getDb().listCollections().toArray()).filter((c) => Object.values(COLLECTIONS).includes(c.name));
  res.json(cols.map((c) => ({ collection: c.name, validationLevel: c.options?.validationLevel, validationAction: c.options?.validationAction, validator: c.options?.validator })));
});

// Extracts the chain of stages of the winning plan (COLLSCAN, IXSCAN, FETCH, SORT...).
function stagesOf(plan) {
  const out = [];
  let node = plan;
  while (node) {
    out.push({ stage: node.stage, ...(node.indexName ? { indexName: node.indexName } : {}), ...(node.direction ? { direction: node.direction } : {}) });
    node = node.inputStage || node.inputStages?.[0];
  }
  return out;
}

// GET /explain?field=patientId&value=7&index=true|false
adminRouter.get("/explain", async (req, res) => {
  const field = String(req.query.field || "patientId");
  const rawValue = req.query.value ?? "7";
  const useIndex = String(req.query.index ?? "true") !== "false";
  const allowed = { patientId: (v) => Number(v), specialty: String, recordType: (v) => String(v).toUpperCase(), tags: String, "diagnosis.icd10": (v) => String(v).toUpperCase(), unit: (v) => String(v).toUpperCase() };
  if (!allowed[field]) throw badRequest(`field must be one of: ${Object.keys(allowed).join(", ")}`);
  const filter = { [field]: allowed[field](rawValue) };

  const cursor = encounters().find(filter).sort({ occurredAt: -1 });
  if (!useIndex) cursor.hint({ $natural: 1 }); // forces a full collection scan
  const started = Date.now();
  const explain = await cursor.explain("executionStats");
  const stats = explain.executionStats;
  const winning = explain.queryPlanner.winningPlan.queryPlan || explain.queryPlanner.winningPlan;
  res.json({
    query: { filter, sort: { occurredAt: -1 }, hint: useIndex ? null : { $natural: 1 } },
    summary: {
      stages: stagesOf(winning),
      indexUsed: stagesOf(winning).find((s) => s.indexName)?.indexName ?? null,
      docsReturned: stats.nReturned,
      keysExamined: stats.totalKeysExamined,
      docsExamined: stats.totalDocsExamined,
      serverTimeMs: stats.executionTimeMillis,
      roundTripMs: Date.now() - started,
    },
    winningPlan: explain.queryPlanner.winningPlan,
  });
});

// Tries to write an invalid document to show schema validation rejecting it.
adminRouter.post("/validation-demo", async (req, res) => {
  const collection = req.query.collection === COLLECTIONS.records ? records() : encounters();
  // Accepts Extended JSON ({"$date": ...}, {"$numberInt": ...}) so the user can test BSON types.
  const doc = req.body && Object.keys(req.body).length
    ? EJSON.deserialize(req.body)
    : { patientId: "seven", recordType: "SURGERY", specialty: "X", occurredAt: "yesterday", clinicalData: "loose text", createdAt: new Date() };
  try {
    const { insertedId } = await collection.insertOne(doc);
    await collection.deleteOne({ _id: insertedId }); // it was valid: undo so the data stays clean
    res.json({ rejected: false, message: "The document passed the schema (it was inserted and then removed).", document: doc });
  } catch (err) {
    if (err.code !== 121) throw err;
    res.json({ rejected: true, code: err.code, message: "Document rejected by the collection's schema validation", document: doc, details: err.errInfo?.details });
  }
});

adminRouter.post("/seed", async (req, res) => {
  const force = String(req.query.force) === "true";
  res.json(await seedDatabase({ force }));
});

adminRouter.get("/search-indexes", async (req, res) => {
  const out = {};
  for (const name of Object.values(COLLECTIONS)) {
    try { out[name] = await getDb().collection(name).listSearchIndexes().toArray(); } catch (err) { out[name] = { error: err.message }; }
  }
  res.json({ atlas: isAtlas(), indexes: out });
});

adminRouter.post("/search-indexes", async (req, res) => {
  res.json(await ensureSearchIndexes());
});

// A raw document, to show the structure on screen.
adminRouter.get("/sample/:collection", async (req, res) => {
  const name = req.params.collection;
  if (!Object.values(COLLECTIONS).includes(name)) throw badRequest("collection must be medical_records or encounters");
  const filter = {};
  if (req.query.specialty) filter.specialty = String(req.query.specialty);
  if (req.query.recordType) filter.recordType = String(req.query.recordType).toUpperCase();
  if (req.query.patientId) filter.patientId = Number(req.query.patientId);
  const [doc] = await getDb().collection(name).aggregate([{ $match: filter }, { $sample: { size: 1 } }]).toArray();
  res.json(doc ?? null);
});
