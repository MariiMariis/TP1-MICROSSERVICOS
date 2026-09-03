// /api/medical-records/search - Atlas Search (full-text, fuzzy, autocomplete, facets).
//
// When the cluster has no Atlas Search (local Mongo in Docker, for example) or the index is
// still being built, the service falls back to a simple $regex and says so in the "engine"
// field of the response - the quality difference is part of the demo.
import { Router } from "express";
import { encounters, getDb, records, SEARCH_INDEXES, searchState } from "../db.js";
import { COLLECTIONS } from "../config.js";
import { badRequest } from "../errors.js";

export const searchRouter = Router();

const readiness = { checkedAt: 0, ready: {} };

async function indexReady(collectionName) {
  const spec = SEARCH_INDEXES[collectionName];
  if (Date.now() - readiness.checkedAt < 20_000 && collectionName in readiness.ready) return readiness.ready[collectionName];
  try {
    const list = await getDb().collection(collectionName).listSearchIndexes().toArray();
    const idx = list.find((i) => i.name === spec.name);
    readiness.ready[collectionName] = Boolean(idx && idx.queryable);
    searchState.available = readiness.ready[collectionName];
    searchState.reason = idx ? `index ${spec.name}: ${idx.status}` : `index ${spec.name} does not exist`;
  } catch (err) {
    readiness.ready[collectionName] = false;
    searchState.available = false;
    searchState.reason = /not supported|Unrecognized|command not found|no such command/i.test(err.message) ? "Atlas Search unavailable on this cluster (not Atlas?)" : err.message;
  }
  readiness.checkedAt = Date.now();
  return readiness.ready[collectionName];
}

const TEXT_PATHS = ["patientName", "chiefComplaint", "notes", "diagnosis.description", "tags", "professional.name", "specialty"];

function textOperator(q) {
  return {
    compound: {
      should: [
        { text: { query: q, path: "patientName", score: { boost: { value: 3 } } } },
        // standard analyzer + fuzzy: tolerates typos ("diabetis" finds "diabetes")
        { text: { query: q, path: ["chiefComplaint", "notes", "diagnosis.description"], fuzzy: { maxEdits: 1, prefixLength: 2 } } },
        // English analyzer (multi "en"): matches inflections and plurals ("headaches" finds "headache")
        { text: { query: q, path: [{ value: "chiefComplaint", multi: "en" }, { value: "notes", multi: "en" }, { value: "diagnosis.description", multi: "en" }] } },
        { text: { query: q, path: ["tags", "professional.name", "specialty"] } },
      ],
      minimumShouldMatch: 1,
    },
  };
}

searchRouter.get("/", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (q.length < 2) throw badRequest("Provide q with at least 2 characters");
  const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 20)));
  const specialty = req.query.specialty ? String(req.query.specialty) : null;
  const recordType = req.query.type ? String(req.query.type).toUpperCase() : null;
  const started = Date.now();

  if (await indexReady(COLLECTIONS.encounters)) {
    const operator = textOperator(q);
    const filters = [];
    if (specialty) filters.push({ equals: { path: "specialty", value: specialty } });
    if (recordType) filters.push({ equals: { path: "recordType", value: recordType } });
    if (filters.length) operator.compound.filter = filters;

    const pipeline = [
      { $search: { index: SEARCH_INDEXES[COLLECTIONS.encounters].name, ...operator, highlight: { path: ["chiefComplaint", "notes", "diagnosis.description", "patientName"] } } },
      { $limit: limit },
      { $project: { patientId: 1, patientName: 1, recordType: 1, specialty: 1, unit: 1, occurredAt: 1, chiefComplaint: 1, notes: 1, diagnosis: 1, professional: 1, tags: 1, score: { $meta: "searchScore" }, highlights: { $meta: "searchHighlights" } } },
    ];
    const metaPipeline = [
      {
        $searchMeta: {
          index: SEARCH_INDEXES[COLLECTIONS.encounters].name,
          facet: {
            operator,
            facets: {
              specialty: { type: "string", path: "specialty", numBuckets: 15 },
              type: { type: "string", path: "recordType", numBuckets: 5 },
              unit: { type: "string", path: "unit", numBuckets: 3 },
            },
          },
        },
      },
    ];
    try {
      const [results, meta] = await Promise.all([
        encounters().aggregate(pipeline).toArray(),
        encounters().aggregate(metaPipeline).toArray().catch(() => []),
      ]);
      return res.json({ engine: "atlas-search", q, tookMs: Date.now() - started, total: meta[0]?.count?.lowerBound ?? results.length, facets: meta[0]?.facet ?? null, results, pipeline });
    } catch (err) {
      searchState.available = false;
      searchState.reason = err.message;
      console.warn("[search] $search failed, using fallback:", err.message);
    }
  }

  // Fallback: regular expression, no ranking, no typo tolerance.
  const regex = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
  const filter = { $or: TEXT_PATHS.map((p) => ({ [p]: regex })) };
  if (specialty) filter.specialty = specialty;
  if (recordType) filter.recordType = recordType;
  const results = await encounters().find(filter).sort({ occurredAt: -1 }).limit(limit).toArray();
  res.json({ engine: "regex-fallback", reason: searchState.reason, q, tookMs: Date.now() - started, total: results.length, facets: null, results, pipeline: [{ $match: filter }, { $sort: { occurredAt: -1 } }, { $limit: limit }] });
});

searchRouter.get("/autocomplete", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (q.length < 2) return res.json({ engine: null, results: [] });
  const limit = Math.min(20, Number(req.query.limit ?? 8));

  if (await indexReady(COLLECTIONS.records)) {
    const pipeline = [
      { $search: { index: SEARCH_INDEXES[COLLECTIONS.records].name, autocomplete: { query: q, path: "fullName", fuzzy: { maxEdits: 1, prefixLength: 1 } } } },
      { $limit: limit },
      { $project: { _id: 0, patientId: 1, fullName: 1, cpf: 1, healthPlan: 1, score: { $meta: "searchScore" } } },
    ];
    try {
      return res.json({ engine: "atlas-search", results: await records().aggregate(pipeline).toArray(), pipeline });
    } catch (err) {
      console.warn("[search] autocomplete failed, using fallback:", err.message);
    }
  }
  const filter = { fullName: { $regex: "^" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } };
  const results = await records().find(filter, { projection: { _id: 0, patientId: 1, fullName: 1, cpf: 1, healthPlan: 1 } }).limit(limit).toArray();
  res.json({ engine: "regex-fallback", results, pipeline: [{ $match: filter }, { $limit: limit }] });
});

searchRouter.get("/status", async (req, res) => {
  const status = {};
  for (const [collection, spec] of Object.entries(SEARCH_INDEXES)) {
    try {
      const list = await getDb().collection(collection).listSearchIndexes().toArray();
      const idx = list.find((i) => i.name === spec.name);
      status[collection] = idx ? { name: idx.name, status: idx.status, queryable: idx.queryable, definition: idx.latestDefinition } : { name: spec.name, status: "MISSING", queryable: false, expectedDefinition: spec.definition };
    } catch (err) {
      status[collection] = { name: spec.name, status: "UNAVAILABLE", queryable: false, reason: err.message, expectedDefinition: spec.definition };
    }
  }
  res.json(status);
});
