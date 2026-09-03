// Conexao com o MongoDB Atlas, schema validation das colecoes, indices e indices do Atlas Search.
//
// Tudo o que o banco "sabe" sobre o dominio esta declarado aqui: e o equivalente,
// no mundo de documentos, ao DDL de um banco relacional - so que opcional e evolutivo.
import dns from "node:dns";
import { MongoClient } from "mongodb";
import { config, COLLECTIONS, RECORD_TYPES, UNITS } from "./config.js";

let client;
let db;

// Estado do Atlas Search: null = ainda nao testado, true/false depois da primeira consulta.
export const searchState = { available: null, reason: null };

export function isAtlas() {
  return /mongodb\.net/i.test(config.mongoUri);
}

// mongodb+srv:// depende de uma consulta DNS do tipo SRV. Em algumas redes o resolver do
// sistema (ex.: um roteador IPv6 link-local) nao responde SRV para o Node, e a conexao falha
// com "querySrv ECONNREFUSED" mesmo com internet funcionando. Nesse caso, usamos resolvers publicos.
async function ensureSrvResolvable(uri) {
  if (!uri.startsWith("mongodb+srv://")) return;
  const host = new URL(uri).hostname;
  try {
    await dns.promises.resolveSrv(`_mongodb._tcp.${host}`);
  } catch (err) {
    const servers = (process.env.DNS_SERVERS || "8.8.8.8,1.1.1.1").split(",").map((s) => s.trim()).filter(Boolean);
    console.warn(`[db] resolver DNS do sistema (${dns.getServers().join(", ")}) nao respondeu a consulta SRV (${err.code}); usando ${servers.join(", ")}`);
    dns.setServers(servers);
  }
}

export async function connect() {
  await ensureSrvResolvable(config.mongoUri);
  client = new MongoClient(config.mongoUri, {
    serverSelectionTimeoutMS: 10_000,
    appName: config.appName,
  });
  await client.connect();
  db = client.db(config.mongoDb);
  await db.command({ ping: 1 });
  return db;
}

export function getDb() {
  if (!db) throw new Error("Banco ainda nao conectado");
  return db;
}

export const prontuarios = () => getDb().collection(COLLECTIONS.prontuarios);
export const atendimentos = () => getDb().collection(COLLECTIONS.atendimentos);

export async function close() {
  await client?.close();
}

// ------------------------------------------------------------------ Schema validation
//
// O MongoDB e "schema flexivel", nao "sem schema": a colecao pode declarar um
// $jsonSchema que o servidor aplica em toda escrita. Aqui validamos o que e
// invariante (identidade do paciente, tipos, enums, GeoJSON) e deixamos livre
// exatamente o que varia por especialidade (clinicalData).

const GEO_POINT = {
  bsonType: "object",
  required: ["type", "coordinates"],
  properties: {
    type: { enum: ["Point"] },
    coordinates: {
      bsonType: "array",
      minItems: 2,
      maxItems: 2,
      items: { bsonType: ["double", "int"] },
      description: "[longitude, latitude] - ordem exigida pelo GeoJSON",
    },
  },
};

export const PRONTUARIO_SCHEMA = {
  $jsonSchema: {
    bsonType: "object",
    title: "Prontuario do paciente",
    required: ["patientId", "cpf", "fullName", "birthDate", "sex", "address", "createdAt"],
    properties: {
      patientId: { bsonType: ["int", "long"], minimum: 1, description: "id do paciente no patient-service (PostgreSQL). Nao ha FK: e uma referencia logica entre servicos." },
      cpf: { bsonType: "string", pattern: "^[0-9]{11}$" },
      fullName: { bsonType: "string", minLength: 3, maxLength: 150 },
      birthDate: { bsonType: "date" },
      sex: { enum: ["F", "M", "O"] },
      bloodType: { enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] },
      heightCm: { bsonType: ["int", "double"], minimum: 30, maximum: 250 },
      weightKg: { bsonType: ["int", "double"], minimum: 1, maximum: 400 },
      healthPlan: { bsonType: "string" },
      preferredUnit: { enum: UNITS.map((u) => u.code) },
      address: {
        bsonType: "object",
        required: ["city", "location"],
        properties: { city: { bsonType: "string" }, location: GEO_POINT },
      },
      allergies: {
        bsonType: "array",
        items: {
          bsonType: "object",
          required: ["substance", "severity"],
          properties: { substance: { bsonType: "string" }, reaction: { bsonType: "string" }, severity: { enum: ["LEVE", "MODERADA", "GRAVE"] } },
        },
      },
      chronicConditions: {
        bsonType: "array",
        items: {
          bsonType: "object",
          required: ["cid10", "description"],
          properties: { cid10: { bsonType: "string", pattern: "^[A-Z][0-9]{2}(\\.[0-9]{1,2})?$" }, description: { bsonType: "string" }, since: { bsonType: "date" }, controlled: { bsonType: "bool" } },
        },
      },
      medications: {
        bsonType: "array",
        items: { bsonType: "object", required: ["name"], properties: { name: { bsonType: "string" }, dose: { bsonType: "string" }, frequency: { bsonType: "string" }, continuous: { bsonType: "bool" } } },
      },
      summary: { bsonType: "object", description: "Campos derivados (computed pattern), atualizados a cada atendimento" },
      createdAt: { bsonType: "date" },
      updatedAt: { bsonType: "date" },
    },
  },
};

export const ATENDIMENTO_SCHEMA = {
  $jsonSchema: {
    bsonType: "object",
    title: "Atendimento (evento clinico)",
    required: ["patientId", "recordType", "specialty", "occurredAt", "clinicalData", "createdAt"],
    properties: {
      patientId: { bsonType: ["int", "long"], minimum: 1 },
      patientName: { bsonType: "string" },
      recordType: { enum: RECORD_TYPES },
      specialty: { bsonType: "string", minLength: 3 },
      unit: { enum: UNITS.map((u) => u.code) },
      professional: { bsonType: "object", required: ["name"], properties: { name: { bsonType: "string" }, license: { bsonType: "string" } } },
      occurredAt: { bsonType: "date" },
      durationMin: { bsonType: ["int", "double"], minimum: 0 },
      chiefComplaint: { bsonType: "string" },
      notes: { bsonType: "string" },
      diagnosis: {
        bsonType: "array",
        items: { bsonType: "object", required: ["cid10", "description"], properties: { cid10: { bsonType: "string", pattern: "^[A-Z][0-9]{2}(\\.[0-9]{1,2})?$" }, description: { bsonType: "string" } } },
      },
      tags: { bsonType: "array", items: { bsonType: "string" } },
      clinicalData: { bsonType: "object", description: "Estrutura livre: cada especialidade grava os campos que fazem sentido para ela" },
      prescriptions: { bsonType: "array", items: { bsonType: "object", required: ["name"] } },
      attachments: { bsonType: "array", items: { bsonType: "object", required: ["fileName"] } },
      billing: { bsonType: "object", properties: { amount: { bsonType: ["double", "int"], minimum: 0 }, payer: { bsonType: "string" } } },
      createdAt: { bsonType: "date" },
    },
  },
};

async function ensureCollection(name, validator) {
  const existing = await getDb().listCollections({ name }).toArray();
  if (existing.length === 0) {
    await getDb().createCollection(name, { validator, validationLevel: "strict", validationAction: "error" });
    console.log(`[db] colecao ${name} criada com schema validation`);
  } else {
    await getDb().command({ collMod: name, validator, validationLevel: "strict", validationAction: "error" });
  }
}

// ------------------------------------------------------------------ Indices

export const INDEXES = {
  [COLLECTIONS.prontuarios]: [
    { key: { patientId: 1 }, options: { name: "uk_patient_id", unique: true } },
    { key: { cpf: 1 }, options: { name: "uk_cpf", unique: true } },
    { key: { fullName: 1 }, options: { name: "idx_full_name" } },
    { key: { "address.location": "2dsphere" }, options: { name: "geo_address_location" } },
    { key: { "allergies.substance": 1 }, options: { name: "idx_allergy_substance" } },
    { key: { "chronicConditions.cid10": 1 }, options: { name: "idx_condition_cid10" } },
    { key: { healthPlan: 1 }, options: { name: "idx_health_plan" } },
  ],
  [COLLECTIONS.atendimentos]: [
    // O indice mais importante do servico: atende a linha do tempo do paciente (consulta dominante).
    { key: { patientId: 1, occurredAt: -1 }, options: { name: "idx_patient_occurred" } },
    { key: { specialty: 1, occurredAt: -1 }, options: { name: "idx_specialty_occurred" } },
    { key: { unit: 1, occurredAt: -1 }, options: { name: "idx_unit_occurred" } },
    { key: { occurredAt: -1 }, options: { name: "idx_occurred" } },
    { key: { recordType: 1 }, options: { name: "idx_record_type" } },
    { key: { tags: 1 }, options: { name: "idx_tags" } },
    { key: { "diagnosis.cid10": 1 }, options: { name: "idx_diagnosis_cid10" } },
  ],
};

// ------------------------------------------------------------------ Atlas Search
//
// Os indices de busca ficam no Lucene do Atlas, fora do mongod. Sao criados via driver
// (createSearchIndexes). Se o cluster nao permitir, a definicao abaixo pode ser colada
// no painel do Atlas (Search > Create Index > JSON Editor).

const TEXT_PT = { type: "string", analyzer: "lucene.standard", multi: { pt: { type: "string", analyzer: "lucene.portuguese" } } };

export const SEARCH_INDEXES = {
  [COLLECTIONS.atendimentos]: {
    name: "atendimentos_search",
    definition: {
      mappings: {
        dynamic: false,
        fields: {
          patientName: [
            { type: "string", analyzer: "lucene.standard" },
            { type: "autocomplete", tokenization: "edgeGram", minGrams: 2, maxGrams: 15, foldDiacritics: true },
          ],
          // Dois analisadores no mesmo campo: o padrao (sem stemming) serve ao fuzzy
          // ("diabetis" ~ "diabetes"); o portugues casa flexoes ("dores" ~ "dor").
          chiefComplaint: TEXT_PT,
          notes: TEXT_PT,
          specialty: [{ type: "string" }, { type: "stringFacet" }],
          recordType: [{ type: "string" }, { type: "stringFacet" }],
          unit: { type: "stringFacet" },
          tags: { type: "string" },
          professional: { type: "document", fields: { name: { type: "string" } } },
          diagnosis: { type: "document", fields: { cid10: { type: "string" }, description: TEXT_PT } },
          occurredAt: { type: "date" },
        },
      },
    },
  },
  [COLLECTIONS.prontuarios]: {
    name: "prontuarios_search",
    definition: {
      mappings: {
        dynamic: false,
        fields: {
          fullName: [
            { type: "string", analyzer: "lucene.standard" },
            { type: "autocomplete", tokenization: "edgeGram", minGrams: 2, maxGrams: 15, foldDiacritics: true },
          ],
          cpf: { type: "string" },
          healthPlan: { type: "stringFacet" },
          address: { type: "document", fields: { neighborhood: [{ type: "string" }, { type: "stringFacet" }] } },
          allergies: { type: "document", fields: { substance: { type: "string" } } },
          chronicConditions: { type: "document", fields: { description: { type: "string", analyzer: "lucene.portuguese" }, cid10: { type: "string" } } },
          medications: { type: "document", fields: { name: { type: "string" } } },
        },
      },
    },
  },
};

export async function ensureSearchIndexes() {
  const report = [];
  for (const [collection, spec] of Object.entries(SEARCH_INDEXES)) {
    try {
      const existing = await getDb().collection(collection).listSearchIndexes().toArray();
      const current = existing.find((i) => i.name === spec.name);
      if (current) {
        if (JSON.stringify(current.latestDefinition?.mappings) !== JSON.stringify(spec.definition.mappings)) {
          await getDb().collection(collection).updateSearchIndex(spec.name, spec.definition);
          report.push({ collection, name: spec.name, status: "definicao atualizada (reindexando)" });
        } else {
          report.push({ collection, name: spec.name, status: "ja existia" });
        }
        continue;
      }
      await getDb().collection(collection).createSearchIndex({ name: spec.name, definition: spec.definition });
      report.push({ collection, name: spec.name, status: "criado (leva ~1 min para ficar ativo)" });
    } catch (err) {
      report.push({ collection, name: spec.name, status: "nao suportado aqui", reason: err.message });
    }
  }
  return report;
}

export async function ensureSchema() {
  await ensureCollection(COLLECTIONS.prontuarios, PRONTUARIO_SCHEMA);
  await ensureCollection(COLLECTIONS.atendimentos, ATENDIMENTO_SCHEMA);
  for (const [collection, indexes] of Object.entries(INDEXES)) {
    for (const { key, options } of indexes) {
      await getDb().collection(collection).createIndex(key, options);
    }
  }
  console.log("[db] schema validation e indices garantidos");
}

export async function serverInfo() {
  const build = await getDb().admin().command({ buildInfo: 1 });
  return { version: build.version, atlas: isAtlas(), database: config.mongoDb };
}
