// /api/medical-records/analytics - executa os aggregation pipelines do catalogo.
import { Router } from "express";
import { getDb, prontuarios } from "../db.js";
import { ANALYTICS } from "../pipelines/analytics.js";
import { badRequest, notFound } from "../errors.js";

export const analyticsRouter = Router();

const DASHBOARD_KEYS = ["kpis", "faixaEtaria", "atendimentosPorMes", "diagnosticos", "especialidades", "medicamentos", "convenios", "imc", "conflitosAlergia", "pacientesMaisAtendidos", "alergiasGraves", "camposPorEspecialidade"];

function parseParams(spec, query) {
  const params = {};
  for (const name of spec.params || []) {
    if (query[name] === undefined) throw badRequest(`Parametro obrigatorio: ${name}`);
    params[name] = name.endsWith("Id") ? Number(query[name]) : String(query[name]);
  }
  return params;
}

export async function runAnalytics(key, query = {}) {
  const spec = ANALYTICS[key];
  if (!spec) throw notFound(`Analise '${key}' nao existe`);
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
  const [totalPacientes, ...reports] = await Promise.all([
    prontuarios().countDocuments(),
    ...DASHBOARD_KEYS.map((key) => runAnalytics(key, req.query)),
  ]);
  const byKey = Object.fromEntries(reports.map((r) => [r.key, r]));
  res.json({ generatedAt: new Date(), tookMs: Date.now() - started, totalPacientes, reports: byKey });
});

analyticsRouter.get("/:key", async (req, res) => {
  res.json(await runAnalytics(req.params.key, req.query));
});
