export const fmtDate = (v) => (v ? new Date(v).toLocaleDateString("en-US", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" }) : "—");
export const fmtDateTime = (v) => (v ? new Date(v).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "—");
export const fmtBRL = (v) => (v == null ? "—" : Number(v).toLocaleString("en-US", { style: "currency", currency: "BRL" }));
export const fmtNum = (v) => (v == null ? "—" : Number(v).toLocaleString("en-US"));
export const cpfMask = (cpf) => (cpf ? String(cpf).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : "—");

export function age(birthDate) {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  const now = new Date();
  let a = now.getUTCFullYear() - b.getUTCFullYear();
  const m = now.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < b.getUTCDate())) a--;
  return a;
}

export const TYPE_LABEL = { CONSULTATION: "Consultation", EXAM: "Exam", PROCEDURE: "Procedure", ADMISSION: "Admission", VACCINE: "Vaccine" };
export const TYPE_TONE = { CONSULTATION: "brand", EXAM: "pg", PROCEDURE: "warn", ADMISSION: "danger", VACCINE: "ok" };

// The appointment-service (Java, Delivery 1) keeps its Portuguese enum; the UI translates it.
export const STATUS_LABEL = { AGENDADA: "Scheduled", CONFIRMADA: "Confirmed", REALIZADA: "Completed", CANCELADA: "Cancelled" };
export const STATUS_TONE = { AGENDADA: "", CONFIRMADA: "brand", REALIZADA: "ok", CANCELADA: "danger" };
export const CIRCUIT_LABEL = { instancia: "instance", estado: "state", descricaoDoEstado: "state description", chamadasNaJanela: "calls in window", chamadasComSucesso: "successful calls", chamadasComFalha: "failed calls", chamadasLentas: "slow calls", taxaDeFalhaPercentual: "failure rate (%)", chamadasNaoPermitidas: "calls not permitted" };

export const SEVERITY_TONE = { MILD: "", MODERATE: "warn", SEVERE: "danger" };
export const UNIT_LABEL = { PINHEIROS: "Pinheiros", MOEMA: "Moema", TATUAPE: "Tatuape" };
export const UNIT_COLOR = { PINHEIROS: "#2a78d6", MOEMA: "#eb6834", TATUAPE: "#1baf7a" };

export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"];
