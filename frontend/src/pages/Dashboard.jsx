import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api.js";
import { Badge, Card, ErrorBox, Loading, StatTile, useLoad } from "../components/ui.jsx";
import PipelineViewer from "../components/PipelineViewer.jsx";
import { AtlasExplainButton } from "../components/AtlasExplain.jsx";
import { fmtBRL, fmtDate, fmtNum, SERIES } from "../lib/format.js";

const AXIS = { fontSize: 12, fill: "#7b8794" };
const GRID = "#eef0f3";

function ChartCard({ report, children, subtitle }) {
  return (
    <Card title={report.title} subtitle={subtitle ?? report.description} actions={<AtlasExplainButton report={report} />}>
      {children}
      <PipelineViewer report={report} />
    </Card>
  );
}

export default function Dashboard() {
  const { data, error, loading, reload } = useLoad(() => api.analytics.dashboard());
  if (loading) return <Loading text="Executando 12 aggregation pipelines no Atlas..." />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const r = data.reports;
  const kpi = r.kpis.result;
  const porTipo = Object.fromEntries((kpi.porTipo || []).map((t) => [t._id, t.total]));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard clinico</h1>
          <p>Cada grafico vem de um aggregation pipeline executado pelo medical-record-service no MongoDB Atlas. Abra "Ver o aggregation pipeline" em qualquer cartao para ver a consulta exata.</p>
        </div>
        <div className="row">
          <Badge tone="mongo">MongoDB Atlas</Badge>
          <Badge>{data.tookMs} ms no total</Badge>
          <button className="btn sm" onClick={reload}>Atualizar</button>
        </div>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <StatTile label="Pacientes com prontuario" value={fmtNum(data.totalPacientes)} hint="colecao prontuarios" />
        <StatTile label="Atendimentos registrados" value={fmtNum(kpi.totalAtendimentos)} hint={`${porTipo.CONSULTA ?? 0} consultas · ${porTipo.EXAME ?? 0} exames · ${porTipo.VACINA ?? 0} vacinas`} />
        <StatTile label="Atendimentos nos ultimos 30 dias" value={fmtNum(kpi.ultimos30dias)} hint="$match em occurredAt" />
        <StatTile label="Faturamento acumulado" value={fmtBRL(kpi.faturamentoTotal)} hint={`ticket medio ${fmtBRL(kpi.ticketMedio)}`} />
      </div>

      <div className="grid cols-2">
        <ChartCard report={r.atendimentosPorMes}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={r.atendimentosPorMes.result} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="periodo" tick={AXIS} tickLine={false} axisLine={false} interval={2} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="consultas" name="Consultas" stackId="a" fill={SERIES[0]} stroke="#fff" strokeWidth={1} />
              <Bar dataKey="exames" name="Exames" stackId="a" fill={SERIES[1]} stroke="#fff" strokeWidth={1} />
              <Bar dataKey="vacinas" name="Vacinas" stackId="a" fill={SERIES[2]} stroke="#fff" strokeWidth={1} />
              <Bar dataKey="outros" name="Procedimentos e internacoes" stackId="a" fill={SERIES[3]} stroke="#fff" strokeWidth={1} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard report={r.faixaEtaria}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={r.faixaEtaria.result} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barGap={2}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="faixa" tick={AXIS} tickLine={false} axisLine={false} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="mulheres" name="Mulheres" fill={SERIES[0]} radius={[4, 4, 0, 0]} barSize={22} />
              <Bar dataKey="homens" name="Homens" fill={SERIES[1]} radius={[4, 4, 0, 0]} barSize={22} />
              <Bar dataKey="comCondicaoCronica" name="Com condicao cronica" fill={SERIES[2]} radius={[4, 4, 0, 0]} barSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard report={r.especialidades}>
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={r.especialidades.result} layout="vertical" margin={{ top: 4, right: 40, left: 40, bottom: 0 }}>
              <CartesianGrid horizontal={false} stroke={GRID} />
              <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="especialidade" tick={AXIS} tickLine={false} axisLine={false} width={120} />
              <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} formatter={(v, n, p) => [`${v} atendimentos · ${p.payload.pacientesDistintos} pacientes · ${p.payload.duracaoMedia} min em media`, "Atendimentos"]} />
              <Bar dataKey="total" name="Atendimentos" fill={SERIES[0]} radius={[0, 4, 4, 0]} barSize={14} label={{ position: "right", fontSize: 11, fill: "#4f5a66" }} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard report={r.diagnosticos}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>CID-10</th><th>Descricao</th><th className="num">Ocorrencias</th><th className="num">Pacientes</th></tr></thead>
              <tbody>
                {r.diagnosticos.result.map((d) => (
                  <tr key={d.cid10}><td><code>{d.cid10}</code></td><td>{d.descricao}</td><td className="num">{d.total}</td><td className="num">{d.pacientesDistintos}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>

        <ChartCard report={r.convenios}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={r.convenios.result} margin={{ top: 8, right: 8, left: -18, bottom: 30 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="convenio" tick={{ ...AXIS, fontSize: 11 }} tickLine={false} axisLine={false} angle={-25} textAnchor="end" interval={0} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} formatter={(v, n, p) => [`${v} pacientes · idade media ${p.payload.idadeMedia}`, "Pacientes"]} />
              <Bar dataKey="pacientes" name="Pacientes" fill={SERIES[0]} radius={[4, 4, 0, 0]} barSize={26} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard report={r.imc}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={r.imc.result} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="classificacao" tick={{ ...AXIS, fontSize: 11 }} tickLine={false} axisLine={false} interval={0} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} formatter={(v, n, p) => [`${v} pacientes · IMC medio ${p.payload.imcMedio}`, "Pacientes"]} />
              <Bar dataKey="pacientes" name="Pacientes" fill={SERIES[0]} radius={[4, 4, 0, 0]} barSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard report={r.conflitosAlergia}>
          {r.conflitosAlergia.result.length === 0 ? <p className="muted">Nenhum conflito encontrado.</p> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Paciente</th><th>Data</th><th>Especialidade</th><th>Prescrito</th><th>Alergias registradas</th></tr></thead>
                <tbody>
                  {r.conflitosAlergia.result.map((c) => (
                    <tr key={c._id}>
                      <td><Link to={`/pacientes/${c.patientId}`}>{c.patientName}</Link></td>
                      <td>{fmtDate(c.occurredAt)}</td>
                      <td>{c.specialty}<div className="muted small">{c.professional}</div></td>
                      <td>{c.conflitos.map((n) => <Badge key={n} tone="danger">{n}</Badge>)}</td>
                      <td className="small">{c.alergias.map((a) => `${a.substance} (${a.severity})`).join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ChartCard>

        <ChartCard report={r.pacientesMaisAtendidos}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Paciente</th><th className="num">Idade</th><th>Convenio</th><th className="num">Condicoes</th><th className="num">Atendimentos</th><th>Ultimo</th></tr></thead>
              <tbody>
                {r.pacientesMaisAtendidos.result.map((p) => (
                  <tr key={p.patientId}>
                    <td><Link to={`/pacientes/${p.patientId}`}>{p.fullName}</Link><div className="muted small">{p.especialidades.join(", ")}</div></td>
                    <td className="num">{p.idade}</td><td>{p.healthPlan}</td><td className="num">{p.condicoes}</td><td className="num"><b>{p.total}</b></td><td>{fmtDate(p.ultimo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>

        <ChartCard report={r.medicamentos}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Medicamento</th><th className="num">Pacientes</th><th>Doses em uso</th></tr></thead>
              <tbody>{r.medicamentos.result.map((m) => <tr key={m.medicamento}><td>{m.medicamento}</td><td className="num">{m.pacientes}</td><td className="small">{m.doses.join(", ")}</td></tr>)}</tbody>
            </table>
          </div>
        </ChartCard>

        <ChartCard report={r.alergiasGraves}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Substancia</th><th className="num">Pacientes</th><th>Quem</th></tr></thead>
              <tbody>{r.alergiasGraves.result.map((a) => <tr key={a.substancia}><td><Badge tone="danger">{a.substancia}</Badge></td><td className="num">{a.pacientes}</td><td className="small">{a.nomes.join(", ")}</td></tr>)}</tbody>
            </table>
          </div>
        </ChartCard>

        <Card className="span-2" title={r.camposPorEspecialidade.title} subtitle={r.camposPorEspecialidade.description} actions={<AtlasExplainButton report={r.camposPorEspecialidade} />}>
          <div className="grid cols-3">
            {r.camposPorEspecialidade.result.map((e) => (
              <div key={e.especialidade}>
                <h3 style={{ marginBottom: 6 }}>{e.especialidade}</h3>
                <div className="chips">{e.campos.map((c) => <span key={c.campo} className="chip"><code>{c.campo}</code><span className="muted">{c.atendimentos}</span></span>)}</div>
              </div>
            ))}
          </div>
          <PipelineViewer report={r.camposPorEspecialidade} />
        </Card>
      </div>
    </>
  );
}
