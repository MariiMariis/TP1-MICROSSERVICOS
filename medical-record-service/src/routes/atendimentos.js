// /api/medical-records - os atendimentos (eventos clinicos), mantendo o contrato da Entrega 1.
import { Router } from "express";
import { ObjectId } from "mongodb";
import { atendimentos, prontuarios } from "../db.js";
import { RECORD_TYPES, UNITS } from "../config.js";
import { badRequest, notFound } from "../errors.js";

export const atendimentosRouter = Router();

function parseObjectId(raw) {
  if (!ObjectId.isValid(raw) || String(new ObjectId(raw)) !== raw) throw badRequest(`id invalido: ${raw}`);
  return new ObjectId(raw);
}

function buildFilter(q) {
  const filter = {};
  if (q.patientId) filter.patientId = Number(q.patientId);
  if (q.specialty) filter.specialty = String(q.specialty);
  if (q.type) filter.recordType = String(q.type).toUpperCase();
  if (q.unit) filter.unit = String(q.unit).toUpperCase();
  if (q.tag) filter.tags = String(q.tag);
  if (q.cid10) filter["diagnosis.cid10"] = String(q.cid10).toUpperCase();
  if (q.professional) filter["professional.name"] = { $regex: String(q.professional), $options: "i" };
  // Consulta que so o modelo de documento torna natural: "atendimentos que POSSUEM tal medicao".
  if (q.clinicalDataKey) filter[`clinicalData.${q.clinicalDataKey}`] = { $exists: true };
  if (q.from || q.to) {
    filter.occurredAt = {};
    if (q.from) filter.occurredAt.$gte = new Date(q.from);
    if (q.to) filter.occurredAt.$lte = new Date(q.to);
  }
  return filter;
}

atendimentosRouter.get("/", async (req, res) => {
  const page = Math.max(0, Number(req.query.page ?? 0));
  const size = Math.min(200, Math.max(1, Number(req.query.size ?? 20)));
  const filter = buildFilter(req.query);
  const [content, total] = await Promise.all([
    atendimentos().find(filter).sort({ occurredAt: -1 }).skip(page * size).limit(size).toArray(),
    atendimentos().countDocuments(filter),
  ]);
  res.json({ content, page, size, total, totalPages: Math.ceil(total / size), filter });
});

// Linha do tempo clinica: a consulta dominante do servico, atendida pelo indice {patientId:1, occurredAt:-1}.
atendimentosRouter.get("/patient/:patientId", async (req, res) => {
  const patientId = Number(req.params.patientId);
  if (!Number.isInteger(patientId)) throw badRequest("patientId invalido");
  const filter = { patientId, ...(req.query.type ? { recordType: String(req.query.type).toUpperCase() } : {}) };
  const timeline = await atendimentos().find(filter).sort({ occurredAt: -1 }).toArray();
  res.json(timeline);
});

atendimentosRouter.get("/:id", async (req, res) => {
  const doc = await atendimentos().findOne({ _id: parseObjectId(req.params.id) });
  if (!doc) throw notFound(`Atendimento ${req.params.id} nao encontrado`);
  res.json(doc);
});

atendimentosRouter.post("/", async (req, res) => {
  const b = req.body || {};
  const patientId = Number(b.patientId);
  if (!Number.isInteger(patientId) || patientId < 1) throw badRequest("patientId e obrigatorio");
  const recordType = String(b.recordType || "").toUpperCase();
  if (!RECORD_TYPES.includes(recordType)) throw badRequest(`recordType deve ser um de: ${RECORD_TYPES.join(", ")}`);
  if (!b.specialty) throw badRequest("specialty e obrigatoria");
  const occurredAt = b.occurredAt ? new Date(b.occurredAt) : new Date();
  if (Number.isNaN(occurredAt.getTime())) throw badRequest("occurredAt invalida");
  if (b.clinicalData !== undefined && (typeof b.clinicalData !== "object" || Array.isArray(b.clinicalData))) throw badRequest("clinicalData deve ser um objeto");

  const prontuario = await prontuarios().findOne({ patientId }, { projection: { fullName: 1, preferredUnit: 1 } });
  const professional = typeof b.professional === "string" ? { name: b.professional } : (b.professional || { name: "Nao informado" });
  const unit = String(b.unit || prontuario?.preferredUnit || UNITS[0].code).toUpperCase();

  const doc = {
    patientId,
    patientName: b.patientName || prontuario?.fullName || `Paciente #${patientId}`,
    recordType,
    specialty: b.specialty,
    unit,
    professional,
    occurredAt,
    durationMin: b.durationMin != null ? Number(b.durationMin) : undefined,
    chiefComplaint: b.chiefComplaint,
    notes: b.notes,
    diagnosis: Array.isArray(b.diagnosis) ? b.diagnosis.map((d) => ({ cid10: String(d.cid10).toUpperCase(), description: d.description })) : [],
    tags: Array.isArray(b.tags) ? b.tags.map(String) : [],
    clinicalData: b.clinicalData || {},
    prescriptions: Array.isArray(b.prescriptions) ? b.prescriptions : [],
    attachments: Array.isArray(b.attachments) ? b.attachments : [],
    billing: b.billing,
    createdAt: new Date(),
  };
  for (const k of Object.keys(doc)) if (doc[k] === undefined) delete doc[k];

  const { insertedId } = await atendimentos().insertOne(doc);

  // Computed pattern: o resumo do prontuario e mantido por operadores atomicos, sem reler os atendimentos.
  const summaryUpdate = {
    $inc: { "summary.totalEncounters": 1, [`summary.byType.${recordType}`]: 1 },
    $max: { "summary.lastEncounterAt": occurredAt },
    $addToSet: { "summary.specialties": doc.specialty },
    $set: { "summary.lastSpecialty": doc.specialty, updatedAt: new Date() },
  };
  if (prontuario) await prontuarios().updateOne({ patientId }, summaryUpdate);

  res.status(201).json({ ...doc, _id: insertedId, mongo: { insertedInto: "atendimentos", summaryUpdate: prontuario ? summaryUpdate : null } });
});

atendimentosRouter.delete("/:id", async (req, res) => {
  const _id = parseObjectId(req.params.id);
  const doc = await atendimentos().findOneAndDelete({ _id });
  if (!doc) throw notFound(`Atendimento ${req.params.id} nao encontrado`);
  await prontuarios().updateOne({ patientId: doc.patientId }, { $inc: { "summary.totalEncounters": -1, [`summary.byType.${doc.recordType}`]: -1 }, $set: { updatedAt: new Date() } });
  res.status(204).end();
});
