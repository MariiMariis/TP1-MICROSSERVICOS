export const fmtDate = (v) => (v ? new Date(v).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—");
export const fmtDateTime = (v) => (v ? new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
export const fmtBRL = (v) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
export const fmtNum = (v) => (v == null ? "—" : Number(v).toLocaleString("pt-BR"));
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

export const TYPE_LABEL = { CONSULTA: "Consulta", EXAME: "Exame", PROCEDIMENTO: "Procedimento", INTERNACAO: "Internacao", VACINA: "Vacina" };
export const TYPE_TONE = { CONSULTA: "brand", EXAME: "pg", PROCEDIMENTO: "warn", INTERNACAO: "danger", VACINA: "ok" };
export const STATUS_TONE = { AGENDADA: "", CONFIRMADA: "brand", REALIZADA: "ok", CANCELADA: "danger" };
export const SEVERITY_TONE = { LEVE: "", MODERADA: "warn", GRAVE: "danger" };
export const UNIT_LABEL = { PINHEIROS: "Pinheiros", MOEMA: "Moema", TATUAPE: "Tatuape" };
export const UNIT_COLOR = { PINHEIROS: "#2a78d6", MOEMA: "#eb6834", TATUAPE: "#1baf7a" };

export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"];
