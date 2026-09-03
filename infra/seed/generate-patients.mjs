// Gera infra/seed/patients.json: a base cadastral compartilhada pelos seeds do
// patient-service (PostgreSQL) e do medical-record-service (MongoDB Atlas).
//
// E deterministico: a mesma semente produz sempre os mesmos 120 pacientes, o que
// garante que o id N no Postgres e o patientId N no Mongo sejam a mesma pessoa.
//
// Uso:  node infra/seed/generate-patients.mjs

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const TOTAL = 120;
const SEED = 20260902;

// ---------------------------------------------------------------- RNG
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(SEED);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const int = (min, max) => Math.floor(rnd() * (max - min + 1)) + min;
const chance = (p) => rnd() < p;
const pad = (n, w) => String(n).padStart(w, "0");

// ---------------------------------------------------------------- Dados base
const FIRST_F = ["Ana", "Beatriz", "Camila", "Daniela", "Elisa", "Fernanda", "Gabriela", "Helena", "Isabela",
  "Juliana", "Larissa", "Mariana", "Natalia", "Patricia", "Rafaela", "Sofia", "Tatiana", "Vanessa", "Luiza",
  "Carolina", "Renata", "Priscila", "Bruna", "Leticia", "Amanda", "Cristina", "Simone", "Marcia", "Rosangela", "Vera"];
const FIRST_M = ["Andre", "Bruno", "Carlos", "Diego", "Eduardo", "Felipe", "Gustavo", "Henrique", "Igor", "Joao",
  "Leonardo", "Marcelo", "Nicolas", "Otavio", "Paulo", "Rafael", "Sergio", "Thiago", "Vinicius", "Lucas",
  "Roberto", "Ricardo", "Fabio", "Alexandre", "Antonio", "Jose", "Francisco", "Luiz", "Pedro", "Mateus"];
const MIDDLE = ["Silva", "Santos", "Oliveira", "Souza", "Rodrigues", "Ferreira", "Alves", "Pereira", "Lima", "Gomes",
  "Costa", "Ribeiro", "Martins", "Carvalho", "Almeida", "Lopes", "Soares", "Fernandes", "Vieira", "Barbosa",
  "Rocha", "Dias", "Nascimento", "Andrade", "Moreira", "Nunes", "Marques", "Machado", "Mendes", "Freitas",
  "Cardoso", "Ramos", "Teixeira", "Correia", "Castro", "Pinto", "Monteiro", "Azevedo", "Cunha", "Campos"];

const PLANS = [
  ["SUS", 0.30], ["Unimed", 0.18], ["Amil", 0.12], ["Bradesco Saude", 0.10], ["SulAmerica", 0.08],
  ["Particular", 0.10], ["Porto Seguro Saude", 0.06], ["NotreDame Intermedica", 0.06],
];
const BLOOD = [["O+", 0.36], ["A+", 0.34], ["B+", 0.08], ["AB+", 0.025], ["O-", 0.09], ["A-", 0.06], ["B-", 0.02], ["AB-", 0.005]];

function weighted(table) {
  let r = rnd();
  for (const [value, p] of table) { r -= p; if (r <= 0) return value; }
  return table[table.length - 1][0];
}

// Bairros de Sao Paulo com coordenada aproximada do centro (lat, lng) e o CEP-base.
const NEIGHBORHOODS = [
  ["Pinheiros", -23.5646, -46.6917, "05422"], ["Vila Madalena", -23.5540, -46.6910, "05433"],
  ["Perdizes", -23.5370, -46.6750, "05015"], ["Moema", -23.6010, -46.6650, "04077"],
  ["Itaim Bibi", -23.5850, -46.6780, "04532"], ["Vila Mariana", -23.5890, -46.6340, "04117"],
  ["Jardins", -23.5680, -46.6600, "01419"], ["Tatuape", -23.5400, -46.5760, "03063"],
  ["Mooca", -23.5570, -46.5980, "03104"], ["Penha", -23.5280, -46.5450, "03605"],
  ["Santana", -23.5040, -46.6270, "02013"], ["Liberdade", -23.5580, -46.6350, "01508"],
  ["Brooklin", -23.6150, -46.6890, "04561"], ["Saude", -23.6180, -46.6370, "04151"],
  ["Ipiranga", -23.5900, -46.6100, "04263"], ["Lapa", -23.5230, -46.7000, "05077"],
  ["Butanta", -23.5710, -46.7200, "05501"], ["Analia Franco", -23.5560, -46.5620, "03337"],
  ["Vila Prudente", -23.5830, -46.5800, "03132"], ["Campo Belo", -23.6200, -46.6700, "04612"],
  ["Bela Vista", -23.5610, -46.6480, "01310"], ["Consolacao", -23.5530, -46.6600, "01302"],
  ["Vila Olimpia", -23.5950, -46.6860, "04551"], ["Aclimacao", -23.5720, -46.6300, "01531"],
];
const STREETS = ["Rua das Acacias", "Avenida Paulista", "Rua Augusta", "Rua Harmonia", "Rua Oscar Freire",
  "Avenida Reboucas", "Rua Cardeal Arcoverde", "Rua Vergueiro", "Avenida Ibirapuera", "Rua Tuiuti",
  "Rua da Mooca", "Avenida Sapopemba", "Rua Voluntarios da Patria", "Rua Galvao Bueno", "Avenida Santo Amaro",
  "Rua Domingos de Morais", "Rua Bom Pastor", "Avenida Pompeia", "Rua Teodoro Sampaio", "Rua Padre Joao Manuel"];

// A unidade "preferida" do paciente e a mais proxima de casa (Pinheiros, Moema ou Tatuape).
const UNITS = [
  { code: "PINHEIROS", lat: -23.5646, lng: -46.6917 },
  { code: "MOEMA", lat: -23.6010, lng: -46.6650 },
  { code: "TATUAPE", lat: -23.5400, lng: -46.5760 },
];
function nearestUnit(lat, lng) {
  let best = null, bestD = Infinity;
  for (const u of UNITS) {
    const d = (u.lat - lat) ** 2 + (u.lng - lng) ** 2;
    if (d < bestD) { bestD = d; best = u.code; }
  }
  return best;
}

const ALLERGIES = [
  ["Dipirona", "urticaria", "MODERADA"], ["Penicilina", "anafilaxia", "GRAVE"], ["Amoxicilina", "exantema", "LEVE"],
  ["Ibuprofeno", "edema de face", "MODERADA"], ["Latex", "dermatite de contato", "LEVE"], ["Frutos do mar", "urticaria", "MODERADA"],
  ["Amendoim", "anafilaxia", "GRAVE"], ["Lactose", "desconforto gastrointestinal", "LEVE"], ["Poeira", "rinite", "LEVE"],
  ["Contraste iodado", "broncoespasmo", "GRAVE"], ["AAS", "urticaria", "MODERADA"], ["Sulfa", "exantema", "MODERADA"],
];

// Condicoes cronicas com CID-10 e os medicamentos tipicamente associados.
const CONDITIONS = [
  { cid10: "I10", description: "Hipertensao arterial essencial", minAge: 35, p: 0.30,
    meds: [["Losartana", "50mg", "1x ao dia"], ["Hidroclorotiazida", "25mg", "1x ao dia"], ["Anlodipino", "5mg", "1x ao dia"]] },
  { cid10: "E11", description: "Diabetes mellitus tipo 2", minAge: 40, p: 0.16,
    meds: [["Metformina", "850mg", "2x ao dia"], ["Glicazida", "30mg", "1x ao dia"]] },
  { cid10: "E78.5", description: "Hiperlipidemia", minAge: 40, p: 0.18, meds: [["Sinvastatina", "20mg", "1x a noite"], ["Rosuvastatina", "10mg", "1x ao dia"]] },
  { cid10: "J45", description: "Asma", minAge: 0, p: 0.09, meds: [["Salbutamol spray", "100mcg", "se necessario"], ["Budesonida inalatoria", "200mcg", "2x ao dia"]] },
  { cid10: "E03.9", description: "Hipotireoidismo", minAge: 25, p: 0.08, meds: [["Levotiroxina", "50mcg", "1x em jejum"]] },
  { cid10: "F41.1", description: "Transtorno de ansiedade generalizada", minAge: 16, p: 0.11, meds: [["Sertralina", "50mg", "1x ao dia"], ["Escitalopram", "10mg", "1x ao dia"]] },
  { cid10: "F32.1", description: "Episodio depressivo moderado", minAge: 18, p: 0.06, meds: [["Fluoxetina", "20mg", "1x ao dia"]] },
  { cid10: "M54.5", description: "Dor lombar baixa", minAge: 25, p: 0.10, meds: [] },
  { cid10: "H52.1", description: "Miopia", minAge: 6, p: 0.20, meds: [] },
  { cid10: "K21.0", description: "Doenca do refluxo gastroesofagico", minAge: 20, p: 0.08, meds: [["Omeprazol", "20mg", "1x em jejum"]] },
  { cid10: "G43", description: "Enxaqueca", minAge: 12, p: 0.07, meds: [["Sumatriptano", "50mg", "se necessario"]] },
  { cid10: "N18.3", description: "Doenca renal cronica estagio 3", minAge: 55, p: 0.03, meds: [] },
  { cid10: "I48", description: "Fibrilacao atrial", minAge: 60, p: 0.04, meds: [["Rivaroxabana", "20mg", "1x ao dia"]] },
];

function makeCpf(n) {
  // 11 digitos unicos e claramente ficticios (nao passam pelo algoritmo de validacao de proposito).
  return "9" + pad(n, 4) + pad(int(0, 999999), 6);
}

// ---------------------------------------------------------------- Geracao
const today = new Date("2026-09-02T00:00:00Z");
const patients = [];
const usedCpf = new Set();

// Os 4 primeiros pacientes sao os mesmos da Entrega 1, para manter os exemplos do README e dos .http validos.
const LEGACY = [
  ["11122233344", "Ana Paula Ribeiro", "1988-03-12", "F", "ana.ribeiro@email.com", "31988880001", "Unimed"],
  ["22233344455", "Carlos Eduardo Souza", "1975-11-02", "M", "carlos.souza@email.com", "31988880002", "SUS"],
  ["33344455566", "Marina Lopes Ferreira", "1996-07-25", "F", "marina.ferreira@email.com", "31988880003", "Particular"],
  ["44455566677", "Roberto Nunes Almeida", "1962-01-30", "M", "roberto.almeida@email.com", "31988880004", "Bradesco Saude"],
];

for (let i = 1; i <= TOTAL; i++) {
  let cpf, fullName, birthDate, sex, email, phone, healthPlan;
  if (i <= LEGACY.length) {
    [cpf, fullName, birthDate, sex, email, phone, healthPlan] = LEGACY[i - 1];
  } else {
    sex = chance(0.53) ? "F" : "M";
    const first = sex === "F" ? pick(FIRST_F) : pick(FIRST_M);
    const mid = pick(MIDDLE);
    let last = pick(MIDDLE); while (last === mid) last = pick(MIDDLE);
    fullName = `${first} ${mid} ${last}`;
    // Distribuicao etaria: de bebes a idosos, com concentracao entre 25 e 65.
    const age = weighted([[int(0, 12), 0.10], [int(13, 24), 0.12], [int(25, 44), 0.33], [int(45, 64), 0.30], [int(65, 89), 0.15]]);
    const birth = new Date(today); birth.setUTCFullYear(today.getUTCFullYear() - age); birth.setUTCMonth(int(0, 11)); birth.setUTCDate(int(1, 28));
    birthDate = birth.toISOString().slice(0, 10);
    do { cpf = makeCpf(i); } while (usedCpf.has(cpf));
    email = `${first}.${last}${i}@email.com`.toLowerCase();
    phone = `119${pad(int(10000000, 99999999), 8)}`;
    healthPlan = weighted(PLANS);
  }
  usedCpf.add(cpf);

  const age = Math.floor((today - new Date(birthDate)) / (365.25 * 24 * 3600 * 1000));
  const [neighborhood, baseLat, baseLng, cepBase] = pick(NEIGHBORHOODS);
  const lat = +(baseLat + (rnd() - 0.5) * 0.016).toFixed(6);
  const lng = +(baseLng + (rnd() - 0.5) * 0.016).toFixed(6);

  const allergies = [];
  if (chance(0.35)) {
    const n = chance(0.25) ? 2 : 1;
    while (allergies.length < n) {
      const [substance, reaction, severity] = pick(ALLERGIES);
      if (!allergies.some(a => a.substance === substance)) allergies.push({ substance, reaction, severity });
    }
  }

  const chronicConditions = [];
  const medications = [];
  for (const c of CONDITIONS) {
    if (age >= c.minAge && chance(c.p)) {
      const sinceYear = today.getUTCFullYear() - int(0, Math.min(15, Math.max(1, age - c.minAge)));
      chronicConditions.push({ cid10: c.cid10, description: c.description, since: `${sinceYear}-${pad(int(1, 12), 2)}-01`, controlled: chance(0.7) });
      if (c.meds.length) {
        const [name, dose, frequency] = pick(c.meds);
        if (!medications.some(m => m.name === name)) medications.push({ name, dose, frequency, continuous: true });
      }
    }
  }

  patients.push({
    id: i,
    cpf,
    fullName,
    birthDate,
    sex,
    email,
    phone,
    healthPlan,
    bloodType: weighted(BLOOD),
    heightCm: age < 13 ? int(60, 150) : (sex === "F" ? int(150, 178) : int(162, 192)),
    weightKg: age < 13 ? int(6, 45) : (sex === "F" ? int(48, 98) : int(58, 118)),
    address: {
      street: pick(STREETS),
      number: int(10, 2500),
      neighborhood,
      city: "Sao Paulo",
      state: "SP",
      zipCode: `${cepBase}-${pad(int(0, 999), 3)}`,
      location: { type: "Point", coordinates: [lng, lat] },
    },
    preferredUnit: nearestUnit(lat, lng),
    allergies,
    chronicConditions,
    medications,
    emergencyContact: { name: `${pick(FIRST_F.concat(FIRST_M))} ${pick(MIDDLE)}`, relationship: pick(["conjuge", "mae", "pai", "filho(a)", "irmao(a)"]), phone: `119${pad(int(10000000, 99999999), 8)}` },
  });
}

const out = join(dirname(fileURLToPath(import.meta.url)), "patients.json");
writeFileSync(out, JSON.stringify(patients, null, 2) + "\n", "utf8");
console.log(`patients.json gerado com ${patients.length} pacientes em ${out}`);
