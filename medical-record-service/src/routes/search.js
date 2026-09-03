// /api/medical-records/search - Atlas Search (full-text, fuzzy, autocomplete, facets).
//
// Quando o cluster nao tem Atlas Search (Mongo local em Docker, por exemplo) ou o
// indice ainda esta sendo construido, o servico cai para um $regex simples e avisa
// no campo "engine" da resposta - a diferenca de qualidade e parte da demo.
import { Router } from "express";
import { atendimentos, getDb, prontuarios, SEARCH_INDEXES, searchState } from "../db.js";
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
    searchState.reason = idx ? `indice ${spec.name}: ${idx.status}` : `indice ${spec.name} nao existe`;
  } catch (err) {
    readiness.ready[collectionName] = false;
    searchState.available = false;
    searchState.reason = /not supported|Unrecognized|command not found|no such command/i.test(err.message) ? "Atlas Search indisponivel neste cluster (nao e Atlas?)" : err.message;
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
        // analisador padrao + fuzzy: tolera erro de digitacao ("diabetis" encontra "diabetes")
        { text: { query: q, path: ["chiefComplaint", "notes", "diagnosis.description"], fuzzy: { maxEdits: 1, prefixLength: 2 } } },
        // analisador portugues (multi "pt"): casa flexoes e plurais ("dores" encontra "dor")
        { text: { query: q, path: [{ value: "chiefComplaint", multi: "pt" }, { value: "notes", multi: "pt" }, { value: "diagnosis.description", multi: "pt" }] } },
        { text: { query: q, path: ["tags", "professional.name", "specialty"] } },
      ],
      minimumShouldMatch: 1,
    },
  };
}

searchRouter.get("/", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (q.length < 2) throw badRequest("Informe q com pelo menos 2 caracteres");
  const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 20)));
  const specialty = req.query.specialty ? String(req.query.specialty) : null;
  const recordType = req.query.type ? String(req.query.type).toUpperCase() : null;
  const started = Date.now();

  if (await indexReady(COLLECTIONS.atendimentos)) {
    const operator = textOperator(q);
    const filters = [];
    if (specialty) filters.push({ equals: { path: "specialty", value: specialty } });
    if (recordType) filters.push({ equals: { path: "recordType", value: recordType } });
    if (filters.length) operator.compound.filter = filters;

    const pipeline = [
      { $search: { index: SEARCH_INDEXES[COLLECTIONS.atendimentos].name, ...operator, highlight: { path: ["chiefComplaint", "notes", "diagnosis.description", "patientName"] } } },
      { $limit: limit },
      { $project: { patientId: 1, patientName: 1, recordType: 1, specialty: 1, unit: 1, occurredAt: 1, chiefComplaint: 1, notes: 1, diagnosis: 1, professional: 1, tags: 1, score: { $meta: "searchScore" }, highlights: { $meta: "searchHighlights" } } },
    ];
    const metaPipeline = [
      {
        $searchMeta: {
          index: SEARCH_INDEXES[COLLECTIONS.atendimentos].name,
          facet: {
            operator,
            facets: {
              especialidade: { type: "string", path: "specialty", numBuckets: 15 },
              tipo: { type: "string", path: "recordType", numBuckets: 5 },
              unidade: { type: "string", path: "unit", numBuckets: 3 },
            },
          },
        },
      },
    ];
    try {
      const [results, meta] = await Promise.all([
        atendimentos().aggregate(pipeline).toArray(),
        atendimentos().aggregate(metaPipeline).toArray().catch(() => []),
      ]);
      return res.json({ engine: "atlas-search", q, tookMs: Date.now() - started, total: meta[0]?.count?.lowerBound ?? results.length, facets: meta[0]?.facet ?? null, results, pipeline });
    } catch (err) {
      searchState.available = false;
      searchState.reason = err.message;
      console.warn("[search] $search falhou, usando fallback:", err.message);
    }
  }

  // Fallback: expressao regular, sem ranking, sem tolerancia a erro de digitacao.
  const regex = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
  const filter = { $or: TEXT_PATHS.map((p) => ({ [p]: regex })) };
  if (specialty) filter.specialty = specialty;
  if (recordType) filter.recordType = recordType;
  const results = await atendimentos().find(filter).sort({ occurredAt: -1 }).limit(limit).toArray();
  res.json({ engine: "regex-fallback", reason: searchState.reason, q, tookMs: Date.now() - started, total: results.length, facets: null, results, pipeline: [{ $match: filter }, { $sort: { occurredAt: -1 } }, { $limit: limit }] });
});

searchRouter.get("/autocomplete", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (q.length < 2) return res.json({ engine: null, results: [] });
  const limit = Math.min(20, Number(req.query.limit ?? 8));

  if (await indexReady(COLLECTIONS.prontuarios)) {
    const pipeline = [
      { $search: { index: SEARCH_INDEXES[COLLECTIONS.prontuarios].name, autocomplete: { query: q, path: "fullName", fuzzy: { maxEdits: 1, prefixLength: 1 } } } },
      { $limit: limit },
      { $project: { _id: 0, patientId: 1, fullName: 1, cpf: 1, healthPlan: 1, score: { $meta: "searchScore" } } },
    ];
    try {
      return res.json({ engine: "atlas-search", results: await prontuarios().aggregate(pipeline).toArray(), pipeline });
    } catch (err) {
      console.warn("[search] autocomplete falhou, usando fallback:", err.message);
    }
  }
  const filter = { fullName: { $regex: "^" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } };
  const results = await prontuarios().find(filter, { projection: { _id: 0, patientId: 1, fullName: 1, cpf: 1, healthPlan: 1 } }).limit(limit).toArray();
  res.json({ engine: "regex-fallback", results, pipeline: [{ $match: filter }, { $limit: limit }] });
});

searchRouter.get("/status", async (req, res) => {
  const status = {};
  for (const [collection, spec] of Object.entries(SEARCH_INDEXES)) {
    try {
      const list = await getDb().collection(collection).listSearchIndexes().toArray();
      const idx = list.find((i) => i.name === spec.name);
      status[collection] = idx ? { name: idx.name, status: idx.status, queryable: idx.queryable, definition: idx.latestDefinition } : { name: spec.name, status: "NAO EXISTE", queryable: false, expectedDefinition: spec.definition };
    } catch (err) {
      status[collection] = { name: spec.name, status: "INDISPONIVEL", queryable: false, reason: err.message, expectedDefinition: spec.definition };
    }
  }
  res.json(status);
});
