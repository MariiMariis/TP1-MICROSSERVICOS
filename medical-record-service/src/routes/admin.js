// /api/medical-records/admin - "bastidores" do MongoDB para a demonstracao:
// explain plan com e sem indice, indices, schema validation, estatisticas e seed.
import { Router } from "express";
import { EJSON } from "bson";
import { atendimentos, ensureSearchIndexes, getDb, INDEXES, isAtlas, prontuarios, searchState, serverInfo } from "../db.js";
import { COLLECTIONS } from "../config.js";
import { badRequest } from "../errors.js";
import { seedDatabase } from "../seed/seed.js";

export const adminRouter = Router();

adminRouter.get("/overview", async (req, res) => {
  const stats = async (name) => {
    const [s] = await getDb().collection(name).aggregate([{ $collStats: { storageStats: {}, count: {} } }]).toArray();
    const st = s.storageStats;
    return { collection: name, documentos: s.count, tamanhoKb: Math.round(st.size / 1024), tamanhoMedioBytes: Math.round(st.avgObjSize || 0), armazenamentoKb: Math.round(st.storageSize / 1024), indices: st.nindexes, tamanhoIndicesKb: Math.round(st.totalIndexSize / 1024) };
  };
  res.json({
    servidor: await serverInfo(),
    atlasSearch: searchState,
    colecoes: await Promise.all([stats(COLLECTIONS.prontuarios), stats(COLLECTIONS.atendimentos)]),
  });
});

adminRouter.get("/indexes", async (req, res) => {
  const result = {};
  for (const name of Object.values(COLLECTIONS)) {
    const list = await getDb().collection(name).indexes();
    result[name] = list.map((i) => ({ name: i.name, key: i.key, unique: Boolean(i.unique), tipo: Object.values(i.key).includes("2dsphere") ? "geoespacial" : i.name === "_id_" ? "padrao" : Object.keys(i.key).length > 1 ? "composto" : "simples" }));
  }
  res.json({ declarados: INDEXES, existentes: result });
});

adminRouter.get("/schema", async (req, res) => {
  // listCollections so aceita nome exato ou regex no filtro; filtramos aqui.
  const cols = (await getDb().listCollections().toArray()).filter((c) => Object.values(COLLECTIONS).includes(c.name));
  res.json(cols.map((c) => ({ collection: c.name, validationLevel: c.options?.validationLevel, validationAction: c.options?.validationAction, validator: c.options?.validator })));
});

// Extrai a cadeia de estagios do plano vencedor (COLLSCAN, IXSCAN, FETCH, SORT...).
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
  const allowed = { patientId: (v) => Number(v), specialty: String, recordType: (v) => String(v).toUpperCase(), tags: String, "diagnosis.cid10": (v) => String(v).toUpperCase(), unit: (v) => String(v).toUpperCase() };
  if (!allowed[field]) throw badRequest(`field deve ser um de: ${Object.keys(allowed).join(", ")}`);
  const filter = { [field]: allowed[field](rawValue) };

  const cursor = atendimentos().find(filter).sort({ occurredAt: -1 });
  if (!useIndex) cursor.hint({ $natural: 1 }); // forca a varredura completa da colecao
  const started = Date.now();
  const explain = await cursor.explain("executionStats");
  const stats = explain.executionStats;
  const winning = explain.queryPlanner.winningPlan.queryPlan || explain.queryPlanner.winningPlan;
  res.json({
    consulta: { filter, sort: { occurredAt: -1 }, hint: useIndex ? null : { $natural: 1 } },
    resumo: {
      estagios: stagesOf(winning),
      indiceUsado: stagesOf(winning).find((s) => s.indexName)?.indexName ?? null,
      documentosRetornados: stats.nReturned,
      chavesExaminadas: stats.totalKeysExamined,
      documentosExaminados: stats.totalDocsExamined,
      tempoMs: stats.executionTimeMillis,
      tempoTotalIdaEVoltaMs: Date.now() - started,
    },
    planoCompleto: explain.queryPlanner.winningPlan,
  });
});

// Tenta gravar um documento invalido para mostrar o schema validation rejeitando.
adminRouter.post("/validation-demo", async (req, res) => {
  const collection = req.query.collection === COLLECTIONS.prontuarios ? prontuarios() : atendimentos();
  // Aceita Extended JSON ({"$date": ...}, {"$numberInt": ...}) para o usuario poder testar tipos BSON.
  const doc = req.body && Object.keys(req.body).length
    ? EJSON.deserialize(req.body)
    : { patientId: "sete", recordType: "CIRURGIA", specialty: "X", occurredAt: "ontem", clinicalData: "texto solto", createdAt: new Date() };
  try {
    const { insertedId } = await collection.insertOne(doc);
    await collection.deleteOne({ _id: insertedId }); // era valido: desfaz para nao sujar a base
    res.json({ rejeitado: false, mensagem: "O documento passou pelo schema (foi inserido e removido em seguida).", documento: doc });
  } catch (err) {
    if (err.code !== 121) throw err;
    res.json({ rejeitado: true, codigo: err.code, mensagem: "Documento rejeitado pelo schema validation da colecao", documento: doc, detalhes: err.errInfo?.details });
  }
});

adminRouter.post("/seed", async (req, res) => {
  const force = String(req.query.force) === "true";
  res.json(await seedDatabase({ force }));
});

adminRouter.get("/search-indexes", async (req, res) => {
  const out = {};
  for (const name of Object.values(COLLECTIONS)) {
    try { out[name] = await getDb().collection(name).listSearchIndexes().toArray(); } catch (err) { out[name] = { erro: err.message }; }
  }
  res.json({ atlas: isAtlas(), indices: out });
});

adminRouter.post("/search-indexes", async (req, res) => {
  res.json(await ensureSearchIndexes());
});

// Um documento cru, para mostrar a estrutura na tela.
adminRouter.get("/sample/:collection", async (req, res) => {
  const name = req.params.collection;
  if (!Object.values(COLLECTIONS).includes(name)) throw badRequest("collection deve ser prontuarios ou atendimentos");
  const filter = {};
  if (req.query.specialty) filter.specialty = String(req.query.specialty);
  if (req.query.recordType) filter.recordType = String(req.query.recordType).toUpperCase();
  if (req.query.patientId) filter.patientId = Number(req.query.patientId);
  const [doc] = await getDb().collection(name).aggregate([{ $match: filter }, { $sample: { size: 1 } }]).toArray();
  res.json(doc ?? null);
});
