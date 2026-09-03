// Formularios de "novo atendimento": cada especialidade tem os proprios campos, que viram
// o clinicalData do documento. Nenhuma migracao e necessaria para acrescentar uma especialidade
// aqui - basta descrever os campos.
export const TEMPLATES = {
  Cardiologia: {
    recordType: "CONSULTA",
    fields: [
      { path: "pressaoArterial.sistolica", label: "PA sistolica (mmHg)", type: "number", value: 130 },
      { path: "pressaoArterial.diastolica", label: "PA diastolica (mmHg)", type: "number", value: 85 },
      { path: "pressaoArterial.unidade", label: "Unidade", type: "hidden", value: "mmHg" },
      { path: "frequenciaCardiaca", label: "Frequencia cardiaca (bpm)", type: "number", value: 72 },
      { path: "ecg.ritmo", label: "ECG - ritmo", type: "select", options: ["sinusal", "fibrilacao atrial", "taquicardia sinusal"], value: "sinusal" },
      { path: "fracaoEjecao", label: "Fracao de ejecao (%)", type: "number", value: 60 },
      { path: "riscoCardiovascular", label: "Risco cardiovascular", type: "select", options: ["baixo", "moderado", "alto"], value: "moderado" },
    ],
  },
  Oftalmologia: {
    recordType: "CONSULTA",
    fields: [
      { path: "acuidadeVisual.olhoDireito", label: "Acuidade OD", type: "text", value: "20/30" },
      { path: "acuidadeVisual.olhoEsquerdo", label: "Acuidade OE", type: "text", value: "20/25" },
      { path: "pressaoIntraocular.olhoDireito", label: "PIO OD (mmHg)", type: "number", value: 15 },
      { path: "pressaoIntraocular.olhoEsquerdo", label: "PIO OE (mmHg)", type: "number", value: 14 },
      { path: "refracao.olhoDireito.esferico", label: "Refracao OD esferico", type: "number", value: -1.25, step: 0.25 },
      { path: "refracao.olhoEsquerdo.esferico", label: "Refracao OE esferico", type: "number", value: -1.0, step: 0.25 },
      { path: "fundoDeOlho", label: "Fundo de olho", type: "text", value: "sem alteracoes" },
    ],
  },
  Ortopedia: {
    recordType: "CONSULTA",
    fields: [
      { path: "articulacao", label: "Articulacao", type: "select", options: ["coluna lombar", "coluna cervical", "joelho", "ombro", "tornozelo", "quadril"], value: "joelho" },
      { path: "lado", label: "Lado", type: "select", options: ["direito", "esquerdo", "n/a"], value: "direito" },
      { path: "escalaDor", label: "Escala de dor (0-10)", type: "number", value: 5, min: 0, max: 10 },
      { path: "amplitudeMovimento", label: "Amplitude de movimento", type: "select", options: ["preservada", "reduzida", "muito reduzida"], value: "reduzida" },
      { path: "conduta", label: "Conduta", type: "text", value: "fisioterapia 2x/semana" },
    ],
  },
  Psiquiatria: {
    recordType: "CONSULTA",
    fields: [
      { path: "escalas.GAD7", label: "GAD-7 (0-21)", type: "number", value: 8, min: 0, max: 21 },
      { path: "escalas.PHQ9", label: "PHQ-9 (0-27)", type: "number", value: 6, min: 0, max: 27 },
      { path: "exameEstadoMental.humor", label: "Humor", type: "select", options: ["eutimico", "ansioso", "deprimido", "irritavel"], value: "ansioso" },
      { path: "exameEstadoMental.sono", label: "Sono", type: "select", options: ["preservado", "insonia inicial", "insonia terminal"], value: "insonia inicial" },
      { path: "psicoterapia", label: "Em psicoterapia?", type: "select", options: ["true", "false"], value: "true", cast: "boolean" },
    ],
  },
  Endocrinologia: {
    recordType: "CONSULTA",
    fields: [
      { path: "glicemiaJejum.valor", label: "Glicemia de jejum (mg/dL)", type: "number", value: 98 },
      { path: "glicemiaJejum.unidade", type: "hidden", value: "mg/dL" },
      { path: "hba1c.valor", label: "HbA1c (%)", type: "number", value: 5.6, step: 0.1 },
      { path: "hba1c.unidade", type: "hidden", value: "%" },
      { path: "tsh.valor", label: "TSH (mUI/L)", type: "number", value: 2.1, step: 0.1 },
      { path: "tsh.unidade", type: "hidden", value: "mUI/L" },
      { path: "imc", label: "IMC", type: "number", value: 26.4, step: 0.1 },
    ],
  },
  Dermatologia: {
    recordType: "CONSULTA",
    fields: [
      { path: "fototipo", label: "Fototipo", type: "select", options: ["I", "II", "III", "IV", "V", "VI"], value: "III" },
      { path: "lesoes.0.localizacao", label: "Lesao - localizacao", type: "text", value: "dorso" },
      { path: "lesoes.0.tipo", label: "Lesao - tipo", type: "select", options: ["macula", "papula", "placa", "nevo", "pustula"], value: "nevo" },
      { path: "lesoes.0.tamanhoMm", label: "Lesao - tamanho (mm)", type: "number", value: 4 },
      { path: "lesoes.0.dermatoscopia", label: "Dermatoscopia", type: "text", value: "sem atipias" },
    ],
  },
  Pediatria: {
    recordType: "CONSULTA",
    fields: [
      { path: "pesoKg", label: "Peso (kg)", type: "number", value: 18.5, step: 0.1 },
      { path: "alturaCm", label: "Altura (cm)", type: "number", value: 108 },
      { path: "percentil.peso", label: "Percentil peso", type: "number", value: 50 },
      { path: "percentil.altura", label: "Percentil altura", type: "number", value: 50 },
      { path: "marcosDesenvolvimento.0", label: "Marcos do desenvolvimento", type: "text", value: "adequados para a idade" },
    ],
  },
  "Clinica Geral": {
    recordType: "CONSULTA",
    fields: [
      { path: "sinaisVitais.pressaoArterial.sistolica", label: "PA sistolica", type: "number", value: 120 },
      { path: "sinaisVitais.pressaoArterial.diastolica", label: "PA diastolica", type: "number", value: 80 },
      { path: "sinaisVitais.temperaturaC", label: "Temperatura (°C)", type: "number", value: 36.6, step: 0.1 },
      { path: "sinaisVitais.saturacaoO2", label: "SpO2 (%)", type: "number", value: 97 },
      { path: "exameFisico", label: "Exame fisico", type: "text", value: "sem alteracoes" },
      { path: "conduta", label: "Conduta", type: "text", value: "sintomaticos e retorno se necessario" },
    ],
  },
  "Analises Clinicas": {
    recordType: "EXAME",
    fields: [
      { path: "hemograma.hemoglobina.valor", label: "Hemoglobina (g/dL)", type: "number", value: 13.8, step: 0.1 },
      { path: "hemograma.hemoglobina.unidade", type: "hidden", value: "g/dL" },
      { path: "hemograma.hemoglobina.referencia", type: "hidden", value: "12.0-15.5" },
      { path: "bioquimica.glicose.valor", label: "Glicose (mg/dL)", type: "number", value: 92 },
      { path: "bioquimica.glicose.unidade", type: "hidden", value: "mg/dL" },
      { path: "bioquimica.glicose.referencia", type: "hidden", value: "70-99" },
      { path: "bioquimica.colesterolTotal.valor", label: "Colesterol total (mg/dL)", type: "number", value: 185 },
      { path: "bioquimica.colesterolTotal.unidade", type: "hidden", value: "mg/dL" },
      { path: "bioquimica.creatinina.valor", label: "Creatinina (mg/dL)", type: "number", value: 0.9, step: 0.01 },
      { path: "bioquimica.creatinina.unidade", type: "hidden", value: "mg/dL" },
      { path: "jejumHoras", label: "Jejum (horas)", type: "number", value: 12 },
    ],
  },
  Imunizacao: {
    recordType: "VACINA",
    fields: [
      { path: "imunobiologico", label: "Imunobiologico", type: "select", options: ["Influenza (gripe)", "COVID-19 (bivalente)", "Hepatite B", "dT (difteria e tetano)", "Febre amarela", "Triplice viral (SCR)"], value: "Influenza (gripe)" },
      { path: "fabricante", label: "Fabricante", type: "text", value: "Butantan" },
      { path: "lote", label: "Lote", type: "text", value: "A123456" },
      { path: "dose", label: "Dose", type: "select", options: ["1a dose", "2a dose", "reforco", "dose unica", "dose anual"], value: "dose anual" },
      { path: "via", label: "Via", type: "select", options: ["intramuscular", "subcutanea", "oral"], value: "intramuscular" },
      { path: "reacaoAdversa", label: "Reacao adversa", type: "text", value: "nenhuma" },
    ],
  },
  Livre: {
    recordType: "CONSULTA",
    free: true,
    fields: [],
  },
};

export const SPECIALTIES = Object.keys(TEMPLATES);

// Monta o objeto clinicalData a partir dos campos preenchidos ("a.b.0.c" vira objeto/array aninhado).
export function buildClinicalData(fields, values) {
  const out = {};
  for (const f of fields) {
    let v = values[f.path] ?? f.value;
    if (v === "" || v == null) continue;
    if (f.type === "number") v = Number(v);
    if (f.cast === "boolean") v = v === true || v === "true";
    const parts = f.path.split(".");
    let node = out;
    parts.forEach((part, i) => {
      const last = i === parts.length - 1;
      if (last) { node[part] = v; return; }
      const nextIsIndex = /^\d+$/.test(parts[i + 1]);
      if (node[part] == null) node[part] = nextIsIndex ? [] : {};
      node = node[part];
    });
  }
  return out;
}
