// Gera os documentos do MongoDB a partir de infra/seed/patients.json:
//   - prontuarios : 1 documento por paciente (dados embutidos)
//   - atendimentos: N documentos por paciente, cada um com clinicalData no formato da especialidade
//
// Deterministico (mesma semente, mesmos dados), para a demo ser reproduzivel.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { UNITS } from "../config.js";

const SEED = 20260903;
const TODAY = new Date("2026-09-02T12:00:00Z");
const DAY = 24 * 3600 * 1000;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let rnd = mulberry32(SEED);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const int = (min, max) => Math.floor(rnd() * (max - min + 1)) + min;
const dec = (min, max, places = 1) => +(min + rnd() * (max - min)).toFixed(places);
const chance = (p) => rnd() < p;
const unitCodes = UNITS.map((u) => u.code);

export function loadPatients() {
  const file = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "infra", "seed", "patients.json");
  return JSON.parse(readFileSync(file, "utf8"));
}

// ---------------------------------------------------------------- Profissionais
const PROFESSIONALS = {
  Cardiologia: [["Dr. Helio Vasconcelos", "CRM-SP 45871"], ["Dra. Luciana Prado", "CRM-SP 78234"]],
  Oftalmologia: [["Dra. Renata Camargo", "CRM-SP 66120"], ["Dr. Paulo Tanaka", "CRM-SP 51987"]],
  Ortopedia: [["Dr. Marcos Vilela", "CRM-SP 39012"], ["Dra. Carla Bittencourt", "CRM-SP 82345"]],
  Psiquiatria: [["Dra. Fernanda Sales", "CRM-SP 71230"], ["Dr. Rodrigo Menezes", "CRM-SP 60456"]],
  Endocrinologia: [["Dra. Patricia Yamamoto", "CRM-SP 55678"]],
  Dermatologia: [["Dr. Andre Figueiredo", "CRM-SP 48901"]],
  Pediatria: [["Dra. Camila Rezende", "CRM-SP 90123"], ["Dr. Felipe Aragao", "CRM-SP 87654"]],
  "Clinica Geral": [["Dr. Joao Batista Lemos", "CRM-SP 33456"], ["Dra. Sonia Marques", "CRM-SP 41234"]],
  Ginecologia: [["Dra. Isabela Furtado", "CRM-SP 69870"]],
  "Analises Clinicas": [["Dra. Regina Alencar", "CRBM-SP 12345"]],
  "Diagnostico por Imagem": [["Dr. Otavio Brandao", "CRM-SP 52345"]],
  Imunizacao: [["Enf. Marcia Coutinho", "COREN-SP 234567"], ["Enf. Tiago Nogueira", "COREN-SP 345678"]],
  "Cirurgia Geral": [["Dr. Eduardo Sampaio", "CRM-SP 47890"]],
};
const professional = (specialty) => { const [name, license] = pick(PROFESSIONALS[specialty]); return { name, license }; };

// ---------------------------------------------------------------- Diagnosticos agudos por especialidade
const ACUTE = {
  "Clinica Geral": [["J06.9", "Infeccao aguda das vias aereas superiores"], ["A09", "Gastroenterite infecciosa"], ["R51", "Cefaleia"], ["M79.1", "Mialgia"], ["N39.0", "Infeccao do trato urinario"], ["K29.7", "Gastrite"], ["Z00.0", "Exame medico geral"]],
  Pediatria: [["J06.9", "Infeccao aguda das vias aereas superiores"], ["H66.9", "Otite media"], ["A09", "Gastroenterite infecciosa"], ["J21.9", "Bronquiolite aguda"], ["Z00.1", "Exame de rotina de saude da crianca"], ["L20.9", "Dermatite atopica"]],
  Cardiologia: [["I10", "Hipertensao arterial essencial"], ["R00.0", "Taquicardia"], ["I25.1", "Doenca aterosclerotica do coracao"], ["Z01.3", "Exame da pressao arterial"]],
  Oftalmologia: [["H52.1", "Miopia"], ["H52.4", "Presbiopia"], ["H10.9", "Conjuntivite"], ["H40.9", "Glaucoma"], ["H25.9", "Catarata senil"]],
  Ortopedia: [["M54.5", "Dor lombar baixa"], ["S93.4", "Entorse de tornozelo"], ["M17.9", "Gonartrose"], ["M75.1", "Sindrome do manguito rotador"], ["M54.2", "Cervicalgia"]],
  Psiquiatria: [["F41.1", "Transtorno de ansiedade generalizada"], ["F32.1", "Episodio depressivo moderado"], ["F51.0", "Insonia"], ["F43.2", "Transtorno de adaptacao"]],
  Endocrinologia: [["E11", "Diabetes mellitus tipo 2"], ["E78.5", "Hiperlipidemia"], ["E03.9", "Hipotireoidismo"], ["E66.9", "Obesidade"]],
  Dermatologia: [["L70.0", "Acne vulgar"], ["L20.9", "Dermatite atopica"], ["B35.4", "Tinea corporis"], ["D22.9", "Nevo melanocitico"], ["L40.0", "Psoriase vulgar"]],
  Ginecologia: [["Z01.4", "Exame ginecologico de rotina"], ["N76.0", "Vaginite aguda"], ["N92.0", "Menstruacao excessiva"], ["Z30.0", "Aconselhamento sobre contracepcao"]],
};

// Medicamentos prescritos em consultas. Alguns coincidem de proposito com alergias
// cadastradas (Dipirona, Ibuprofeno, Amoxicilina, AAS), para o $lookup do dashboard
// encontrar conflitos reais.
const PRESCRIPTIONS = {
  analgesico: [["Dipirona", "500mg", "6/6h", 5], ["Paracetamol", "750mg", "8/8h", 5], ["Ibuprofeno", "400mg", "8/8h", 5]],
  antibiotico: [["Amoxicilina", "500mg", "8/8h", 7], ["Azitromicina", "500mg", "1x ao dia", 3], ["Nitrofurantoina", "100mg", "6/6h", 7]],
  cardio: [["Losartana", "50mg", "1x ao dia", 30], ["AAS", "100mg", "1x ao dia", 30], ["Anlodipino", "5mg", "1x ao dia", 30]],
  psi: [["Sertralina", "50mg", "1x ao dia", 30], ["Escitalopram", "10mg", "1x ao dia", 30], ["Zolpidem", "10mg", "a noite", 15]],
  endo: [["Metformina", "850mg", "2x ao dia", 30], ["Sinvastatina", "20mg", "1x a noite", 30], ["Levotiroxina", "50mcg", "1x em jejum", 30]],
  derm: [["Adapaleno gel", "0,1%", "1x a noite", 60], ["Hidrocortisona creme", "1%", "2x ao dia", 7], ["Cetoconazol creme", "2%", "2x ao dia", 14]],
};
const rx = (group, n = 1) => {
  const out = [];
  while (out.length < n) {
    const [name, dose, frequency, days] = pick(PRESCRIPTIONS[group]);
    if (!out.some((p) => p.name === name)) out.push({ name, dose, frequency, days });
  }
  return out;
};

const has = (p, cid) => p.chronicConditions.some((c) => c.cid10 === cid);
const ageAt = (p, date) => Math.floor((date - new Date(p.birthDate)) / (365.25 * DAY));

// ---------------------------------------------------------------- Geradores de clinicalData
const COMPLAINTS = {
  Cardiologia: ["Retorno para controle da pressao arterial", "Palpitacoes aos esforcos", "Dor toracica atipica ha 2 semanas", "Acompanhamento de hipertensao", "Cansaco ao subir escadas"],
  "Clinica Geral": ["Dor de garganta e febre ha 3 dias", "Diarreia e vomitos ha 2 dias", "Dor de cabeca frequente", "Check-up anual", "Dor ao urinar", "Dores no corpo e coriza", "Azia apos as refeicoes"],
  Pediatria: ["Febre e tosse ha 2 dias", "Consulta de puericultura", "Dor de ouvido", "Manchas na pele com coceira", "Chiado no peito a noite", "Vomitos e diarreia"],
  Oftalmologia: ["Dificuldade para enxergar de longe", "Olhos vermelhos e lacrimejando", "Revisao de grau", "Vista embacada para leitura", "Dor de cabeca ao final do dia"],
  Ortopedia: ["Dor lombar ha 3 semanas", "Torceu o tornozelo jogando futebol", "Dor no joelho ao subir escadas", "Dor no ombro ao levantar o braco", "Dor no pescoco e formigamento no braco"],
  Psiquiatria: ["Ansiedade e dificuldade para dormir", "Tristeza persistente e desanimo", "Retorno para ajuste de medicacao", "Crises de panico", "Estresse no trabalho"],
  Endocrinologia: ["Controle de diabetes", "Acompanhamento de tireoide", "Ganho de peso e cansaco", "Resultado de exames de colesterol", "Sede excessiva e urina frequente"],
  Dermatologia: ["Espinhas no rosto e costas", "Mancha escura nas costas que cresceu", "Coceira e descamacao no cotovelo", "Manchas avermelhadas no tronco", "Verificacao de pintas"],
  Ginecologia: ["Consulta de rotina e preventivo", "Corrimento e coceira", "Menstruacao muito intensa", "Orientacao sobre anticoncepcional", "Colica menstrual forte"],
};

function vitals(p, date) {
  const age = ageAt(p, date);
  const hyper = has(p, "I10");
  return {
    pressaoArterial: { sistolica: hyper ? int(130, 165) : int(105, 130), diastolica: hyper ? int(84, 100) : int(65, 84), unidade: "mmHg" },
    frequenciaCardiaca: int(58, 96),
    temperaturaC: dec(35.8, 37.4),
    saturacaoO2: int(94, 99),
    pesoKg: age < 13 ? int(6, 45) : p.weightKg + int(-3, 3),
  };
}

const CLINICAL = {
  Cardiologia: (p, date, idx) => {
    const hyper = has(p, "I10");
    const controlled = p.chronicConditions.find((c) => c.cid10 === "I10")?.controlled;
    // Tendencia: pacientes controlados melhoram ao longo das consultas.
    const drift = controlled ? -idx * 4 : 0;
    return {
      pressaoArterial: { sistolica: (hyper ? int(140, 168) : int(108, 128)) + drift, diastolica: (hyper ? int(86, 102) : int(66, 82)) + Math.round(drift / 2), unidade: "mmHg" },
      frequenciaCardiaca: int(56, 98),
      ecg: { ritmo: has(p, "I48") ? "fibrilacao atrial" : "sinusal", alteracoes: chance(0.3) ? [pick(["sobrecarga ventricular esquerda", "bloqueio de ramo direito", "extrassistoles isoladas"])] : [] },
      fracaoEjecao: dec(52, 68),
      riscoCardiovascular: pick(["baixo", "moderado", "alto"]),
      medicacoesEmUso: p.medications.map((m) => `${m.name} ${m.dose}`),
    };
  },
  Oftalmologia: () => ({
    acuidadeVisual: { olhoDireito: pick(["20/20", "20/25", "20/30", "20/40", "20/60"]), olhoEsquerdo: pick(["20/20", "20/25", "20/30", "20/40", "20/60"]) },
    pressaoIntraocular: { olhoDireito: int(11, 21), olhoEsquerdo: int(11, 21), unidade: "mmHg" },
    refracao: {
      olhoDireito: { esferico: dec(-4, 1, 2), cilindrico: dec(-1.5, 0, 2), eixo: int(0, 180) },
      olhoEsquerdo: { esferico: dec(-4, 1, 2), cilindrico: dec(-1.5, 0, 2), eixo: int(0, 180) },
    },
    fundoDeOlho: pick(["sem alteracoes", "sem alteracoes", "escavacao aumentada", "drusas maculares"]),
  }),
  Ortopedia: () => {
    const joint = pick(["coluna lombar", "tornozelo", "joelho", "ombro", "coluna cervical"]);
    return {
      articulacao: joint,
      lado: joint.includes("coluna") ? "n/a" : pick(["direito", "esquerdo"]),
      escalaDor: int(2, 9),
      amplitudeMovimento: pick(["preservada", "reduzida", "muito reduzida"]),
      achados: [pick(["contratura muscular", "edema", "crepitacao", "instabilidade ligamentar", "dor a palpacao"])],
      conduta: pick(["fisioterapia 2x/semana", "imobilizacao por 10 dias", "anti-inflamatorio e repouso", "infiltracao articular", "encaminhado para RM"]),
    };
  },
  Psiquiatria: (p, date, idx) => ({
    escalas: { GAD7: Math.max(0, int(6, 18) - idx * 2), PHQ9: Math.max(0, int(4, 16) - idx * 2) },
    exameEstadoMental: { humor: pick(["ansioso", "deprimido", "eutimico", "irritavel"]), afeto: pick(["congruente", "embotado", "labil"]), pensamento: pick(["logico", "acelerado", "lentificado"]), sono: pick(["insonia inicial", "insonia terminal", "preservado"]) },
    riscoSuicida: "ausente",
    psicoterapia: chance(0.6),
  }),
  Endocrinologia: (p) => {
    const dm = has(p, "E11");
    return {
      glicemiaJejum: { valor: dm ? int(110, 190) : int(78, 99), unidade: "mg/dL" },
      hba1c: { valor: dm ? dec(6.5, 9.2) : dec(4.8, 5.6), unidade: "%" },
      tsh: { valor: has(p, "E03.9") ? dec(4.5, 12) : dec(0.8, 4.0, 2), unidade: "mUI/L" },
      imc: dec(19, 36),
      circunferenciaAbdominal: { valor: int(72, 118), unidade: "cm" },
    };
  },
  Dermatologia: () => ({
    fototipo: pick(["II", "III", "IV", "V"]),
    lesoes: [{ localizacao: pick(["face", "dorso", "antebraco", "couro cabeludo", "membros inferiores"]), tipo: pick(["papula", "macula", "placa", "nevo", "pustula"]), tamanhoMm: int(2, 18), dermatoscopia: pick(["padrao reticular tipico", "sem atipias", "padrao globular", "assimetria leve"]) }],
    fotoprotecao: chance(0.5) ? "orientada" : "em uso",
  }),
  Pediatria: (p, date) => {
    const age = ageAt(p, date);
    return {
      pesoKg: dec(3 + age * 3, 5 + age * 3.5),
      alturaCm: int(50 + age * 6, 55 + age * 7),
      perimetroCefalicoCm: age < 3 ? int(34, 50) : undefined,
      percentil: { peso: pick([10, 25, 50, 75, 90]), altura: pick([10, 25, 50, 75, 90]) },
      marcosDesenvolvimento: age < 6 ? [pick(["adequados para a idade", "fala em frases", "anda sem apoio", "controle esfincteriano"])] : ["adequados para a idade"],
      aleitamento: age < 2 ? pick(["exclusivo", "misto", "desmame"]) : undefined,
    };
  },
  "Clinica Geral": (p, date) => ({
    sinaisVitais: vitals(p, date),
    anamnese: pick(["nega comorbidades alem das ja registradas", "tabagista, 10 cigarros/dia", "sedentario", "pratica atividade fisica regular", "etilismo social"]),
    exameFisico: pick(["sem alteracoes", "orofaringe hiperemiada", "abdome doloroso a palpacao", "ausculta pulmonar limpa"]),
    conduta: pick(["sintomaticos e retorno se necessario", "solicitado exames laboratoriais", "encaminhado ao especialista", "orientacoes e repouso"]),
  }),
  Ginecologia: () => ({
    dum: new Date(TODAY - int(1, 40) * DAY),
    cicloRegular: chance(0.75),
    metodoContraceptivo: pick(["nenhum", "ACO", "DIU de cobre", "DIU hormonal", "preservativo"]),
    preventivo: { coletado: chance(0.6), resultadoAnterior: pick(["negativo para lesao", "ASC-US", "negativo para lesao"]) },
    gestacoes: { G: int(0, 3), P: int(0, 2), A: int(0, 1) },
  }),
};

function pediatricRemove(obj) {
  for (const k of Object.keys(obj)) if (obj[k] === undefined) delete obj[k];
  return obj;
}

// Exames laboratoriais: dezenas de analitos, cada um com valor, unidade e referencia.
function labExam(p) {
  const dm = has(p, "E11");
  const analito = (valor, unidade, referencia) => ({ valor, unidade, referencia });
  return {
    hemograma: {
      hemoglobina: analito(p.sex === "F" ? dec(11.5, 15.2) : dec(13, 17), "g/dL", p.sex === "F" ? "12.0-15.5" : "13.5-17.5"),
      hematocrito: analito(dec(36, 50), "%", "36-50"),
      leucocitos: analito(int(4200, 10800), "/mm3", "4000-11000"),
      plaquetas: analito(int(150000, 410000), "/mm3", "150000-450000"),
    },
    bioquimica: {
      glicose: analito(dm ? int(105, 185) : int(75, 99), "mg/dL", "70-99"),
      colesterolTotal: analito(int(150, 260), "mg/dL", "<190"),
      hdl: analito(int(35, 70), "mg/dL", ">40"),
      ldl: analito(int(80, 180), "mg/dL", "<130"),
      triglicerides: analito(int(70, 260), "mg/dL", "<150"),
      creatinina: analito(has(p, "N18.3") ? dec(1.5, 2.4, 2) : dec(0.6, 1.2, 2), "mg/dL", "0.6-1.2"),
      ureia: analito(int(18, 48), "mg/dL", "15-45"),
      tgo: analito(int(15, 45), "U/L", "<40"),
      tgp: analito(int(12, 55), "U/L", "<41"),
    },
    jejumHoras: 12,
    laboratorio: "MedFlow Analises Clinicas",
  };
}

function imagingExam(p) {
  const tipo = pick(["Raio-X", "Ultrassonografia", "Ressonancia Magnetica", "Tomografia Computadorizada"]);
  const regiao = pick(["torax", "coluna lombar", "joelho direito", "abdome total", "ombro esquerdo", "cranio"]);
  return {
    modalidade: tipo,
    regiao,
    contraste: tipo.includes("Tomografia") || tipo.includes("Ressonancia") ? chance(0.4) : false,
    achados: [pick(["sem alteracoes significativas", "sinais de espondilose", "derrame articular discreto", "esteatose hepatica leve", "condensacao em base direita", "protrusao discal L4-L5"])],
    laudo: "Exame realizado com tecnica habitual. Correlacionar com dados clinicos.",
    radiologista: "Dr. Otavio Brandao",
  };
}

const VACCINES = [
  ["Influenza (gripe)", "Butantan", "intramuscular", "deltoide esquerdo"],
  ["COVID-19 (bivalente)", "Pfizer", "intramuscular", "deltoide direito"],
  ["Hepatite B", "Butantan", "intramuscular", "deltoide esquerdo"],
  ["dT (difteria e tetano)", "Butantan", "intramuscular", "deltoide direito"],
  ["Febre amarela", "Bio-Manguinhos", "subcutanea", "braco esquerdo"],
  ["Triplice viral (SCR)", "Bio-Manguinhos", "subcutanea", "braco direito"],
  ["Pneumococica 23", "MSD", "intramuscular", "deltoide esquerdo"],
];
function vaccine(p, date) {
  const age = ageAt(p, date);
  const [imunobiologico, fabricante, via, local] = age < 13 ? pick(VACCINES.slice(2, 6)) : age >= 60 ? pick([VACCINES[0], VACCINES[1], VACCINES[6]]) : pick(VACCINES);
  return {
    imunobiologico, fabricante, via, local,
    lote: `${pick(["A", "B", "C"])}${int(100000, 999999)}`,
    dose: pick(["1a dose", "2a dose", "reforco", "dose unica", "dose anual"]),
    validade: new Date(date.getTime() + int(180, 720) * DAY),
    proximaDose: chance(0.5) ? new Date(date.getTime() + int(30, 365) * DAY) : null,
    reacaoAdversa: chance(0.08) ? "dor local e febre baixa" : "nenhuma",
  };
}

function procedure() {
  const nome = pick(["Sutura de ferimento em mao", "Retirada de nevo", "Infiltracao de joelho", "Cauterizacao de verruga", "Drenagem de abscesso", "Pequena cirurgia de unha encravada"]);
  return {
    procedimento: nome,
    anestesia: pick(["local", "local com sedacao"]),
    duracaoMin: int(15, 60),
    materialEnviadoParaAnatomopatologico: nome.includes("nevo"),
    intercorrencias: chance(0.1) ? "sangramento discreto controlado" : "nenhuma",
    equipe: [{ funcao: "cirurgiao", nome: "Dr. Eduardo Sampaio" }, { funcao: "instrumentador", nome: "Tec. Rosana Lima" }],
    curativo: "revisao em 7 dias",
  };
}

function admission(p, date) {
  const dias = int(2, 9);
  const motivo = has(p, "I10") || has(p, "I48") ? pick(["Crise hipertensiva", "Insuficiencia cardiaca descompensada"]) : pick(["Pneumonia comunitaria", "Desidratacao por gastroenterite", "Pielonefrite", "Crise asmatica"]);
  return {
    motivo,
    leito: `${int(2, 6)}${String.fromCharCode(65 + int(0, 3))}-${int(1, 12)}`,
    admissao: date,
    alta: new Date(date.getTime() + dias * DAY),
    diasInternado: dias,
    evolucaoDiaria: Array.from({ length: Math.min(dias, 4) }, (_, i) => ({ dia: i + 1, nota: pick(["estavel, mantida conduta", "melhora clinica", "afebril, aceitando dieta", "iniciado desmame de O2"]) })),
    procedimentosRealizados: [pick(["antibioticoterapia venosa", "hidratacao venosa", "oxigenoterapia", "monitorizacao cardiaca"])],
    desfecho: "alta melhorada",
  };
}

// ---------------------------------------------------------------- Montagem
function baseDoc(p, recordType, specialty, date, unit) {
  return {
    patientId: p.id,
    patientName: p.fullName,
    recordType,
    specialty,
    unit,
    professional: professional(specialty),
    occurredAt: date,
    createdAt: date,
    tags: [],
    attachments: [],
  };
}

function billingFor(p, recordType) {
  const base = { CONSULTA: int(180, 420), EXAME: int(90, 900), PROCEDIMENTO: int(350, 1800), INTERNACAO: int(4000, 18000), VACINA: int(60, 220) }[recordType];
  return { amount: p.healthPlan === "SUS" ? 0 : base, payer: p.healthPlan, currency: "BRL" };
}

function consultation(p, specialty, date, unit, idx, acuteOnly = false) {
  const doc = baseDoc(p, "CONSULTA", specialty, date, unit);
  doc.durationMin = int(15, 50);
  doc.chiefComplaint = pick(COMPLAINTS[specialty]);
  doc.clinicalData = pediatricRemove(CLINICAL[specialty](p, date, idx));
  doc.diagnosis = [];
  const chronicForSpecialty = { Cardiologia: ["I10", "I48"], Endocrinologia: ["E11", "E78.5", "E03.9"], Psiquiatria: ["F41.1", "F32.1"], Oftalmologia: ["H52.1"], Ortopedia: ["M54.5"], Pediatria: ["J45"], "Clinica Geral": ["J45", "K21.0", "G43"] }[specialty] || [];
  for (const cid of chronicForSpecialty) {
    const c = p.chronicConditions.find((x) => x.cid10 === cid);
    if (c && !acuteOnly) doc.diagnosis.push({ cid10: c.cid10, description: c.description });
  }
  if (doc.diagnosis.length === 0 || chance(0.3)) {
    const [cid10, description] = pick(ACUTE[specialty]);
    if (!doc.diagnosis.some((d) => d.cid10 === cid10)) doc.diagnosis.push({ cid10, description });
  }
  doc.tags = [...new Set([specialty.toLowerCase().replace(/ /g, "-"), ...doc.diagnosis.map((d) => d.description.split(" ")[0].toLowerCase()), idx > 0 ? "retorno" : "primeira-consulta"])];
  doc.notes = `${doc.chiefComplaint}. ${pick(["Paciente orientado(a) quanto ao tratamento.", "Solicitados exames complementares.", "Mantida medicacao em uso.", "Retorno em 30 dias.", "Encaminhado(a) para acompanhamento.", "Boa resposta ao tratamento anterior."])}`;
  const rxGroup = { Cardiologia: "cardio", Psiquiatria: "psi", Endocrinologia: "endo", Dermatologia: "derm", Ortopedia: "analgesico", "Clinica Geral": chance(0.5) ? "analgesico" : "antibiotico", Pediatria: chance(0.6) ? "analgesico" : "antibiotico", Ginecologia: "antibiotico", Oftalmologia: null }[specialty];
  doc.prescriptions = rxGroup && chance(0.75) ? rx(rxGroup, chance(0.3) ? 2 : 1) : [];
  doc.billing = billingFor(p, "CONSULTA");
  return doc;
}

function exam(p, date, unit, lab) {
  const specialty = lab ? "Analises Clinicas" : "Diagnostico por Imagem";
  const doc = baseDoc(p, "EXAME", specialty, date, unit);
  doc.durationMin = lab ? 10 : int(20, 45);
  doc.clinicalData = lab ? labExam(p) : imagingExam(p);
  doc.diagnosis = [{ cid10: "Z01.7", description: "Exame laboratorial" }];
  if (!lab) doc.diagnosis = [{ cid10: "Z01.8", description: "Exame de imagem" }];
  doc.tags = lab ? ["exame", "laboratorio", "sangue"] : ["exame", "imagem", doc.clinicalData.modalidade.toLowerCase().split(" ")[0]];
  doc.notes = lab ? "Coleta realizada em jejum. Resultados liberados no mesmo dia." : `${doc.clinicalData.modalidade} de ${doc.clinicalData.regiao}: ${doc.clinicalData.achados[0]}.`;
  doc.attachments = [{ fileName: lab ? `laudo-lab-${date.toISOString().slice(0, 10)}.pdf` : `laudo-imagem-${date.toISOString().slice(0, 10)}.pdf`, contentType: "application/pdf", url: `/laudos/${p.id}/${date.getTime()}.pdf`, sizeKb: int(120, 2400) }];
  doc.billing = billingFor(p, "EXAME");
  return doc;
}

function vaccination(p, date, unit) {
  const doc = baseDoc(p, "VACINA", "Imunizacao", date, unit);
  doc.durationMin = 5;
  doc.clinicalData = vaccine(p, date);
  doc.diagnosis = [{ cid10: "Z23", description: "Necessidade de imunizacao" }];
  doc.tags = ["vacina", doc.clinicalData.imunobiologico.split(" ")[0].toLowerCase()];
  doc.notes = `Aplicada ${doc.clinicalData.imunobiologico}, ${doc.clinicalData.dose}. Sem intercorrencias.`;
  doc.billing = billingFor(p, "VACINA");
  return doc;
}

function procedureDoc(p, date, unit) {
  const doc = baseDoc(p, "PROCEDIMENTO", "Cirurgia Geral", date, unit);
  doc.clinicalData = procedure();
  doc.durationMin = doc.clinicalData.duracaoMin + 20;
  doc.diagnosis = [pick([["L91.8", "Lesao cutanea"], ["S61.0", "Ferimento de dedo"], ["L60.0", "Unha encravada"], ["D22.9", "Nevo melanocitico"]])].map(([cid10, description]) => ({ cid10, description }));
  doc.tags = ["procedimento", "ambulatorial"];
  doc.notes = `${doc.clinicalData.procedimento} sob anestesia ${doc.clinicalData.anestesia}. Intercorrencias: ${doc.clinicalData.intercorrencias}.`;
  doc.prescriptions = rx("analgesico", 1);
  doc.billing = billingFor(p, "PROCEDIMENTO");
  return doc;
}

function admissionDoc(p, date, unit) {
  const doc = baseDoc(p, "INTERNACAO", "Clinica Geral", date, unit);
  doc.clinicalData = admission(p, date);
  doc.durationMin = doc.clinicalData.diasInternado * 24 * 60;
  doc.diagnosis = [{ cid10: doc.clinicalData.motivo.startsWith("Pneumonia") ? "J18.9" : doc.clinicalData.motivo.startsWith("Crise hip") ? "I10" : doc.clinicalData.motivo.startsWith("Insuf") ? "I50.0" : doc.clinicalData.motivo.startsWith("Pielo") ? "N10" : doc.clinicalData.motivo.startsWith("Crise asm") ? "J45.9" : "A09", description: doc.clinicalData.motivo }];
  doc.tags = ["internacao", "urgencia"];
  doc.notes = `Internacao por ${doc.clinicalData.motivo.toLowerCase()}, ${doc.clinicalData.diasInternado} dias de permanencia. Desfecho: ${doc.clinicalData.desfecho}.`;
  doc.prescriptions = rx("antibiotico", 1);
  doc.billing = billingFor(p, "INTERNACAO");
  return doc;
}

const randomDate = (maxDaysAgo = 1095, minDaysAgo = 1) => new Date(TODAY.getTime() - int(minDaysAgo, maxDaysAgo) * DAY - int(0, 9) * 3600 * 1000);
const unitFor = (p) => (chance(0.8) ? p.preferredUnit : pick(unitCodes));

export function generateEncounters(patients) {
  rnd = mulberry32(SEED);
  const all = [];
  for (const p of patients) {
    const age = ageAt(p, TODAY);
    const docs = [];
    const specialties = new Set();

    if (age < 13) {
      specialties.add("Pediatria");
    } else {
      specialties.add("Clinica Geral");
      if (has(p, "I10") || has(p, "I48")) specialties.add("Cardiologia");
      if (has(p, "E11") || has(p, "E78.5") || has(p, "E03.9")) specialties.add("Endocrinologia");
      if (has(p, "F41.1") || has(p, "F32.1")) specialties.add("Psiquiatria");
      if (has(p, "H52.1") || (age >= 45 && chance(0.4))) specialties.add("Oftalmologia");
      if (has(p, "M54.5") || chance(0.2)) specialties.add("Ortopedia");
      if (chance(0.25)) specialties.add("Dermatologia");
      if (p.sex === "F" && age >= 16 && age <= 65 && chance(0.6)) specialties.add("Ginecologia");
      if (age >= 60 && chance(0.5)) specialties.add("Cardiologia");
    }

    for (const specialty of specialties) {
      const n = ["Cardiologia", "Endocrinologia", "Psiquiatria", "Pediatria"].includes(specialty) ? int(2, 4) : int(1, 2);
      const dates = Array.from({ length: n }, () => randomDate()).sort((a, b) => a - b);
      dates.forEach((date, idx) => docs.push(consultation(p, specialty, date, unitFor(p), idx)));
    }

    // Exames: quem tem condicao cronica faz mais exames de sangue.
    const labs = p.chronicConditions.length ? int(1, 3) : chance(0.6) ? 1 : 0;
    for (let i = 0; i < labs; i++) docs.push(exam(p, randomDate(), unitFor(p), true));
    if (specialties.has("Ortopedia") || chance(0.2)) docs.push(exam(p, randomDate(), unitFor(p), false));

    // Vacinas: criancas e idosos vacinam mais.
    const shots = age < 13 ? int(2, 4) : age >= 60 ? int(1, 3) : chance(0.7) ? 1 : 0;
    for (let i = 0; i < shots; i++) docs.push(vaccination(p, randomDate(), unitFor(p)));

    if (chance(0.10)) docs.push(procedureDoc(p, randomDate(), unitFor(p)));
    if (chance(0.06) || (age >= 70 && chance(0.2))) docs.push(admissionDoc(p, randomDate(), unitFor(p)));

    // Garante atividade recente para o dashboard ter "ultimos 30 dias".
    if (chance(0.35)) docs.push(consultation(p, age < 13 ? "Pediatria" : "Clinica Geral", randomDate(28, 1), unitFor(p), 1, true));

    all.push(...docs);
  }
  all.sort((a, b) => a.occurredAt - b.occurredAt);
  return all;
}

export function buildProntuario(p, encounters) {
  const mine = encounters.filter((e) => e.patientId === p.id);
  const last = mine[mine.length - 1];
  const now = new Date();
  return {
    patientId: p.id,
    cpf: p.cpf,
    fullName: p.fullName,
    birthDate: new Date(p.birthDate + "T00:00:00Z"),
    sex: p.sex,
    email: p.email,
    phone: p.phone,
    healthPlan: p.healthPlan,
    bloodType: p.bloodType,
    heightCm: p.heightCm,
    weightKg: p.weightKg,
    address: p.address,
    preferredUnit: p.preferredUnit,
    allergies: p.allergies,
    chronicConditions: p.chronicConditions.map((c) => ({ ...c, since: new Date(c.since + "T00:00:00Z") })),
    medications: p.medications,
    emergencyContact: p.emergencyContact,
    summary: {
      totalEncounters: mine.length,
      lastEncounterAt: last?.occurredAt ?? null,
      lastSpecialty: last?.specialty ?? null,
      specialties: [...new Set(mine.map((e) => e.specialty))],
      byType: mine.reduce((acc, e) => ({ ...acc, [e.recordType]: (acc[e.recordType] || 0) + 1 }), {}),
    },
    createdAt: now,
    updatedAt: now,
  };
}
