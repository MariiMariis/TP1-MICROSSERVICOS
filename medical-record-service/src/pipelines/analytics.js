// Catalogo de aggregation pipelines usados pelo dashboard.
//
// Cada entrada descreve: em qual colecao roda, o que responde e o pipeline em si.
// A API devolve o pipeline junto com o resultado, para que o front-end mostre
// "a consulta que gerou este grafico" - o ponto central da demonstracao.
import { COLLECTIONS } from "../config.js";

const monthsAgo = (n) => { const d = new Date(); d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0); d.setUTCMonth(d.getUTCMonth() - n); return d; };
const daysAgo = (n) => new Date(Date.now() - n * 24 * 3600 * 1000);

const AGE = { $dateDiff: { startDate: "$birthDate", endDate: "$$NOW", unit: "year" } };

export const ANALYTICS = {
  kpis: {
    title: "Indicadores gerais",
    description: "$facet executa varios sub-pipelines em uma unica passada pela colecao.",
    collection: COLLECTIONS.atendimentos,
    stages: () => [
      {
        $facet: {
          total: [{ $count: "n" }],
          ultimos30dias: [{ $match: { occurredAt: { $gte: daysAgo(30) } } }, { $count: "n" }],
          porTipo: [{ $group: { _id: "$recordType", total: { $sum: 1 } } }, { $sort: { total: -1 } }],
          porUnidade: [{ $group: { _id: "$unit", total: { $sum: 1 } } }, { $sort: { total: -1 } }],
          faturamento: [{ $group: { _id: null, total: { $sum: "$billing.amount" }, medio: { $avg: "$billing.amount" } } }],
        },
      },
      {
        $project: {
          totalAtendimentos: { $ifNull: [{ $arrayElemAt: ["$total.n", 0] }, 0] },
          ultimos30dias: { $ifNull: [{ $arrayElemAt: ["$ultimos30dias.n", 0] }, 0] },
          porTipo: 1,
          porUnidade: 1,
          faturamentoTotal: { $round: [{ $ifNull: [{ $arrayElemAt: ["$faturamento.total", 0] }, 0] }, 2] },
          ticketMedio: { $round: [{ $ifNull: [{ $arrayElemAt: ["$faturamento.medio", 0] }, 0] }, 2] },
        },
      },
    ],
  },

  faixaEtaria: {
    title: "Pacientes por faixa etaria",
    description: "$dateDiff calcula a idade a partir de birthDate na hora da consulta; $bucket agrupa em faixas.",
    collection: COLLECTIONS.prontuarios,
    stages: () => [
      { $addFields: { idade: AGE } },
      {
        $bucket: {
          groupBy: "$idade",
          boundaries: [0, 13, 25, 45, 65, 200],
          default: "desconhecida",
          output: {
            total: { $sum: 1 },
            mulheres: { $sum: { $cond: [{ $eq: ["$sex", "F"] }, 1, 0] } },
            homens: { $sum: { $cond: [{ $eq: ["$sex", "M"] }, 1, 0] } },
            idadeMedia: { $avg: "$idade" },
            comCondicaoCronica: { $sum: { $cond: [{ $gt: [{ $size: { $ifNull: ["$chronicConditions", []] } }, 0] }, 1, 0] } },
          },
        },
      },
      {
        $project: {
          _id: 0,
          faixa: {
            $switch: {
              branches: [
                { case: { $eq: ["$_id", 0] }, then: "0-12" },
                { case: { $eq: ["$_id", 13] }, then: "13-24" },
                { case: { $eq: ["$_id", 25] }, then: "25-44" },
                { case: { $eq: ["$_id", 45] }, then: "45-64" },
                { case: { $eq: ["$_id", 65] }, then: "65+" },
              ],
              default: "?",
            },
          },
          total: 1, mulheres: 1, homens: 1, comCondicaoCronica: 1,
          idadeMedia: { $round: ["$idadeMedia", 1] },
        },
      },
    ],
  },

  atendimentosPorMes: {
    title: "Atendimentos por mes (24 meses)",
    description: "$year/$month extraem partes da data; $group soma por tipo com $cond.",
    collection: COLLECTIONS.atendimentos,
    stages: () => [
      { $match: { occurredAt: { $gte: monthsAgo(23) } } },
      {
        $group: {
          _id: { ano: { $year: "$occurredAt" }, mes: { $month: "$occurredAt" } },
          total: { $sum: 1 },
          consultas: { $sum: { $cond: [{ $eq: ["$recordType", "CONSULTA"] }, 1, 0] } },
          exames: { $sum: { $cond: [{ $eq: ["$recordType", "EXAME"] }, 1, 0] } },
          vacinas: { $sum: { $cond: [{ $eq: ["$recordType", "VACINA"] }, 1, 0] } },
          outros: { $sum: { $cond: [{ $in: ["$recordType", ["PROCEDIMENTO", "INTERNACAO"]] }, 1, 0] } },
        },
      },
      { $sort: { "_id.ano": 1, "_id.mes": 1 } },
      {
        $project: {
          _id: 0,
          periodo: { $dateToString: { format: "%Y-%m", date: { $dateFromParts: { year: "$_id.ano", month: "$_id.mes" } } } },
          total: 1, consultas: 1, exames: 1, vacinas: 1, outros: 1,
        },
      },
    ],
  },

  diagnosticos: {
    title: "Diagnosticos mais frequentes (CID-10)",
    description: "$unwind abre o array diagnosis; $addToSet + $size contam pacientes distintos.",
    collection: COLLECTIONS.atendimentos,
    stages: () => [
      { $unwind: "$diagnosis" },
      { $group: { _id: "$diagnosis.cid10", descricao: { $first: "$diagnosis.description" }, total: { $sum: 1 }, pacientes: { $addToSet: "$patientId" } } },
      { $project: { _id: 0, cid10: "$_id", descricao: 1, total: 1, pacientesDistintos: { $size: "$pacientes" } } },
      { $sort: { total: -1 } },
      { $limit: 10 },
    ],
  },

  especialidades: {
    title: "Atendimentos por especialidade",
    description: "Contagem, duracao media e pacientes distintos por especialidade.",
    collection: COLLECTIONS.atendimentos,
    stages: () => [
      { $group: { _id: "$specialty", total: { $sum: 1 }, duracaoMedia: { $avg: "$durationMin" }, pacientes: { $addToSet: "$patientId" }, ultimo: { $max: "$occurredAt" } } },
      { $project: { _id: 0, especialidade: "$_id", total: 1, duracaoMedia: { $round: ["$duracaoMedia", 0] }, pacientesDistintos: { $size: "$pacientes" }, ultimo: 1 } },
      { $sort: { total: -1 } },
    ],
  },

  medicamentos: {
    title: "Medicamentos de uso continuo mais prescritos",
    description: "Le o array embutido medications do prontuario, sem nenhuma tabela de associacao.",
    collection: COLLECTIONS.prontuarios,
    stages: () => [
      { $unwind: "$medications" },
      { $group: { _id: "$medications.name", pacientes: { $sum: 1 }, doses: { $addToSet: "$medications.dose" } } },
      { $sort: { pacientes: -1 } },
      { $limit: 10 },
      { $project: { _id: 0, medicamento: "$_id", pacientes: 1, doses: 1 } },
    ],
  },

  convenios: {
    title: "Pacientes por convenio",
    collection: COLLECTIONS.prontuarios,
    stages: () => [
      { $group: { _id: "$healthPlan", pacientes: { $sum: 1 }, idadeMedia: { $avg: AGE } } },
      { $sort: { pacientes: -1 } },
      { $project: { _id: 0, convenio: "$_id", pacientes: 1, idadeMedia: { $round: ["$idadeMedia", 1] } } },
    ],
  },

  imc: {
    title: "Distribuicao de IMC (adultos)",
    description: "Campo calculado com $divide/$pow e $bucket com as faixas da OMS.",
    collection: COLLECTIONS.prontuarios,
    stages: () => [
      { $addFields: { idade: AGE } },
      { $match: { idade: { $gte: 18 }, heightCm: { $gt: 0 }, weightKg: { $gt: 0 } } },
      { $addFields: { imc: { $divide: ["$weightKg", { $pow: [{ $divide: ["$heightCm", 100] }, 2] }] } } },
      {
        $bucket: {
          groupBy: "$imc",
          boundaries: [0, 18.5, 25, 30, 35, 100],
          default: "?",
          output: { pacientes: { $sum: 1 }, imcMedio: { $avg: "$imc" } },
        },
      },
      {
        $project: {
          _id: 0,
          classificacao: {
            $switch: {
              branches: [
                { case: { $eq: ["$_id", 0] }, then: "Abaixo do peso" },
                { case: { $eq: ["$_id", 18.5] }, then: "Eutrofico" },
                { case: { $eq: ["$_id", 25] }, then: "Sobrepeso" },
                { case: { $eq: ["$_id", 30] }, then: "Obesidade I" },
                { case: { $eq: ["$_id", 35] }, then: "Obesidade II+" },
              ],
              default: "?",
            },
          },
          pacientes: 1,
          imcMedio: { $round: ["$imcMedio", 1] },
        },
      },
    ],
  },

  conflitosAlergia: {
    title: "Prescricoes em conflito com alergias registradas",
    description: "$lookup junta atendimentos ao prontuario do paciente; $filter cruza prescricoes com alergias. Um join entre colecoes, sem FK.",
    collection: COLLECTIONS.atendimentos,
    stages: () => [
      { $match: { "prescriptions.0": { $exists: true } } },
      { $lookup: { from: COLLECTIONS.prontuarios, localField: "patientId", foreignField: "patientId", as: "prontuario" } },
      { $unwind: "$prontuario" },
      { $addFields: { conflitos: { $filter: { input: "$prescriptions", as: "p", cond: { $in: ["$$p.name", "$prontuario.allergies.substance"] } } } } },
      { $match: { "conflitos.0": { $exists: true } } },
      { $project: { _id: 1, patientId: 1, patientName: 1, occurredAt: 1, specialty: 1, professional: "$professional.name", conflitos: "$conflitos.name", alergias: "$prontuario.allergies" } },
      { $sort: { occurredAt: -1 } },
    ],
  },

  pacientesMaisAtendidos: {
    title: "Pacientes com mais atendimentos",
    description: "$lookup com sub-pipeline: para cada prontuario, resume os atendimentos da outra colecao.",
    collection: COLLECTIONS.prontuarios,
    stages: () => [
      {
        $lookup: {
          from: COLLECTIONS.atendimentos,
          let: { pid: "$patientId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$patientId", "$$pid"] } } },
            { $group: { _id: null, total: { $sum: 1 }, ultimo: { $max: "$occurredAt" }, especialidades: { $addToSet: "$specialty" } } },
          ],
          as: "resumo",
        },
      },
      { $unwind: "$resumo" },
      { $project: { _id: 0, patientId: 1, fullName: 1, healthPlan: 1, idade: AGE, condicoes: { $size: { $ifNull: ["$chronicConditions", []] } }, total: "$resumo.total", ultimo: "$resumo.ultimo", especialidades: "$resumo.especialidades" } },
      { $sort: { total: -1, fullName: 1 } },
      { $limit: 10 },
    ],
  },

  camposPorEspecialidade: {
    title: "Campos clinicos que cada especialidade registra",
    description: "$objectToArray transforma clinicalData em pares chave/valor: prova de que a mesma colecao guarda estruturas diferentes.",
    collection: COLLECTIONS.atendimentos,
    stages: () => [
      { $project: { specialty: 1, campos: { $objectToArray: "$clinicalData" } } },
      { $unwind: "$campos" },
      { $group: { _id: { especialidade: "$specialty", campo: "$campos.k" }, total: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $group: { _id: "$_id.especialidade", campos: { $push: { campo: "$_id.campo", atendimentos: "$total" } } } },
      { $project: { _id: 0, especialidade: "$_id", campos: 1 } },
      { $sort: { especialidade: 1 } },
    ],
  },

  alergiasGraves: {
    title: "Alergias graves por substancia",
    collection: COLLECTIONS.prontuarios,
    stages: () => [
      { $unwind: "$allergies" },
      { $match: { "allergies.severity": "GRAVE" } },
      { $group: { _id: "$allergies.substance", pacientes: { $sum: 1 }, nomes: { $push: "$fullName" } } },
      { $sort: { pacientes: -1 } },
      { $project: { _id: 0, substancia: "$_id", pacientes: 1, nomes: 1 } },
    ],
  },

  evolucaoPressao: {
    title: "Evolucao da pressao arterial do paciente",
    description: "Le um campo aninhado que so existe em atendimentos de Cardiologia/Clinica Geral.",
    collection: COLLECTIONS.atendimentos,
    params: ["patientId"],
    stages: ({ patientId }) => [
      { $match: { patientId, "clinicalData.pressaoArterial": { $exists: true } } },
      { $sort: { occurredAt: 1 } },
      { $project: { _id: 0, data: "$occurredAt", especialidade: "$specialty", sistolica: "$clinicalData.pressaoArterial.sistolica", diastolica: "$clinicalData.pressaoArterial.diastolica", frequenciaCardiaca: "$clinicalData.frequenciaCardiaca" } },
    ],
  },
};
