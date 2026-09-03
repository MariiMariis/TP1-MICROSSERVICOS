// /api/medical-records/patients - o documento "prontuario" (1 por paciente).
//
// Mostra as operacoes de atualizacao de arrays embutidos ($addToSet, $push, $pull)
// e o upsert. Cada resposta de escrita devolve tambem a operacao enviada ao Mongo.
import { Router } from "express";
import { prontuarios } from "../db.js";
import { badRequest, notFound } from "../errors.js";
import { UNITS } from "../config.js";

export const prontuariosRouter = Router();

const LIST_PROJECTION = { _id: 1, patientId: 1, cpf: 1, fullName: 1, birthDate: 1, sex: 1, healthPlan: 1, bloodType: 1, preferredUnit: 1, "address.neighborhood": 1, allergies: 1, chronicConditions: 1, summary: 1 };

function parsePatientId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) throw badRequest(`patientId invalido: ${raw}`);
  return id;
}

async function loadOr404(patientId) {
  const doc = await prontuarios().findOne({ patientId });
  if (!doc) throw notFound(`Prontuario do paciente ${patientId} nao encontrado`);
  return doc;
}

prontuariosRouter.get("/", async (req, res) => {
  const page = Math.max(0, Number(req.query.page ?? 0));
  const size = Math.min(200, Math.max(1, Number(req.query.size ?? 20)));
  const filter = {};
  if (req.query.q) filter.fullName = { $regex: String(req.query.q), $options: "i" };
  if (req.query.healthPlan) filter.healthPlan = String(req.query.healthPlan);
  if (req.query.unit) filter.preferredUnit = String(req.query.unit).toUpperCase();
  if (req.query.allergy) filter["allergies.substance"] = String(req.query.allergy);
  if (req.query.cid10) filter["chronicConditions.cid10"] = String(req.query.cid10);
  if (req.query.neighborhood) filter["address.neighborhood"] = String(req.query.neighborhood);

  const [content, total] = await Promise.all([
    prontuarios().find(filter, { projection: LIST_PROJECTION }).sort({ fullName: 1 }).skip(page * size).limit(size).toArray(),
    prontuarios().countDocuments(filter),
  ]);
  res.json({ content, page, size, total, totalPages: Math.ceil(total / size), filter });
});

prontuariosRouter.get("/:patientId", async (req, res) => {
  res.json(await loadOr404(parsePatientId(req.params.patientId)));
});

// Cria ou atualiza o prontuario (usado pelo front-end logo apos cadastrar o paciente no patient-service).
prontuariosRouter.put("/:patientId", async (req, res) => {
  const patientId = parsePatientId(req.params.patientId);
  const b = req.body || {};
  for (const f of ["cpf", "fullName", "birthDate", "sex"]) if (!b[f]) throw badRequest(`Campo obrigatorio: ${f}`);
  if (!/^\d{11}$/.test(String(b.cpf))) throw badRequest("cpf deve ter 11 digitos");
  const birthDate = new Date(b.birthDate);
  if (Number.isNaN(birthDate.getTime())) throw badRequest("birthDate invalida");

  const address = b.address || {};
  const lng = Number(address.longitude ?? address.location?.coordinates?.[0]);
  const lat = Number(address.latitude ?? address.location?.coordinates?.[1]);
  const location = Number.isFinite(lng) && Number.isFinite(lat) ? { type: "Point", coordinates: [lng, lat] } : UNITS[0].location;

  const now = new Date();
  const update = {
    $set: {
      cpf: String(b.cpf), fullName: b.fullName, birthDate, sex: b.sex,
      email: b.email ?? null, phone: b.phone ?? null, healthPlan: b.healthPlan ?? "Particular",
      ...(b.bloodType ? { bloodType: b.bloodType } : {}),
      ...(b.heightCm ? { heightCm: Number(b.heightCm) } : {}),
      ...(b.weightKg ? { weightKg: Number(b.weightKg) } : {}),
      address: {
        street: address.street ?? null, number: address.number ?? null, neighborhood: address.neighborhood ?? null,
        city: address.city ?? "Sao Paulo", state: address.state ?? "SP", zipCode: address.zipCode ?? null, location,
      },
      preferredUnit: b.preferredUnit ?? UNITS[0].code,
      updatedAt: now,
    },
    $setOnInsert: { patientId, allergies: [], chronicConditions: [], medications: [], summary: { totalEncounters: 0, lastEncounterAt: null, lastSpecialty: null, specialties: [], byType: {} }, createdAt: now },
  };
  const result = await prontuarios().findOneAndUpdate({ patientId }, update, { upsert: true, returnDocument: "after" });
  res.status(201).json({ prontuario: result, mongo: { operation: "findOneAndUpdate(upsert)", filter: { patientId }, update } });
});

async function mutate(res, patientId, update, operation = "updateOne") {
  await loadOr404(patientId);
  const result = await prontuarios().findOneAndUpdate({ patientId }, { ...update, $set: { ...(update.$set || {}), updatedAt: new Date() } }, { returnDocument: "after" });
  res.json({ prontuario: result, mongo: { operation, filter: { patientId }, update } });
}

prontuariosRouter.post("/:patientId/allergies", async (req, res) => {
  const { substance, reaction, severity } = req.body || {};
  if (!substance || !severity) throw badRequest("Informe substance e severity (LEVE, MODERADA ou GRAVE)");
  await mutate(res, parsePatientId(req.params.patientId), { $addToSet: { allergies: { substance, reaction: reaction ?? null, severity } } });
});

prontuariosRouter.delete("/:patientId/allergies/:substance", async (req, res) => {
  await mutate(res, parsePatientId(req.params.patientId), { $pull: { allergies: { substance: req.params.substance } } });
});

prontuariosRouter.post("/:patientId/medications", async (req, res) => {
  const { name, dose, frequency, continuous } = req.body || {};
  if (!name) throw badRequest("Informe name");
  await mutate(res, parsePatientId(req.params.patientId), { $push: { medications: { name, dose: dose ?? null, frequency: frequency ?? null, continuous: continuous !== false } } });
});

prontuariosRouter.delete("/:patientId/medications/:name", async (req, res) => {
  await mutate(res, parsePatientId(req.params.patientId), { $pull: { medications: { name: req.params.name } } });
});

prontuariosRouter.post("/:patientId/conditions", async (req, res) => {
  const { cid10, description, since, controlled } = req.body || {};
  if (!cid10 || !description) throw badRequest("Informe cid10 e description");
  const condition = { cid10: String(cid10).toUpperCase(), description, since: since ? new Date(since) : new Date(), controlled: controlled === true };
  await mutate(res, parsePatientId(req.params.patientId), { $addToSet: { chronicConditions: condition } });
});

prontuariosRouter.delete("/:patientId/conditions/:cid10", async (req, res) => {
  await mutate(res, parsePatientId(req.params.patientId), { $pull: { chronicConditions: { cid10: req.params.cid10.toUpperCase() } } });
});
