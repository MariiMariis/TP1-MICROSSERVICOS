import { useState } from "react";
import { api } from "../api.js";
import { Badge, Card, ErrorBox, Loading, Tabs, useLoad } from "../components/ui.jsx";
import JsonView from "../components/JsonView.jsx";
import { fmtNum } from "../lib/format.js";

const INVALID_DOC = `{
  "patientId": "sete",
  "recordType": "CIRURGIA",
  "specialty": "X",
  "occurredAt": "ontem",
  "clinicalData": "texto solto",
  "createdAt": { "$date": "2026-09-02T12:00:00Z" }
}`;

function Overview() {
  const ov = useLoad(() => api.admin.overview());
  if (ov.loading) return <Loading />;
  if (ov.error) return <ErrorBox error={ov.error} onRetry={ov.reload} />;
  const d = ov.data;
  return (
    <div className="stack">
      <div className="row">
        <Badge tone="mongo">MongoDB {d.servidor.version}</Badge>
        <Badge tone={d.servidor.atlas ? "mongo" : "warn"}>{d.servidor.atlas ? "Atlas" : "instancia local"}</Badge>
        <Badge>database {d.servidor.database}</Badge>
        <Badge tone={d.atlasSearch.available ? "ok" : d.atlasSearch.available === false ? "warn" : ""}>Atlas Search: {d.atlasSearch.available == null ? "ainda nao usado" : d.atlasSearch.available ? "ativo" : d.atlasSearch.reason}</Badge>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Colecao</th><th className="num">Documentos</th><th className="num">Tamanho medio (bytes)</th><th className="num">Dados (KB)</th><th className="num">Em disco (KB)</th><th className="num">Indices</th><th className="num">Indices (KB)</th></tr></thead>
          <tbody>{d.colecoes.map((c) => <tr key={c.collection}><td><b>{c.collection}</b></td><td className="num">{fmtNum(c.documentos)}</td><td className="num">{fmtNum(c.tamanhoMedioBytes)}</td><td className="num">{fmtNum(c.tamanhoKb)}</td><td className="num">{fmtNum(c.armazenamentoKb)}</td><td className="num">{c.indices}</td><td className="num">{fmtNum(c.tamanhoIndicesKb)}</td></tr>)}</tbody>
        </table>
      </div>
      <p className="muted small">Fonte: estagio <code>$collStats</code>. O tamanho em disco e menor que o de dados por causa da compressao do WiredTiger.</p>
    </div>
  );
}

function Explain() {
  const [field, setField] = useState("patientId");
  const [value, setValue] = useState("7");
  const [runs, setRuns] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  async function run() {
    setBusy(true); setError(null);
    try {
      const [sem, com] = await Promise.all([api.admin.explain({ field, value, index: false }), api.admin.explain({ field, value, index: true })]);
      setRuns({ sem, com });
    } catch (err) { setError(err); } finally { setBusy(false); }
  }
  const Box = ({ title, r, tone }) => (
    <div className={`box ${tone}`}>
      <h3>{title}</h3>
      <div className="row" style={{ margin: "6px 0" }}>{r.resumo.estagios.map((s, i) => <Badge key={i} tone={s.stage === "COLLSCAN" ? "danger" : s.stage === "IXSCAN" ? "ok" : ""}>{s.stage}{s.indexName ? ` (${s.indexName})` : ""}</Badge>)}</div>
      <dl className="kv">
        <dt>documentos examinados</dt><dd className="big">{fmtNum(r.resumo.documentosExaminados)}</dd>
        <dt>chaves de indice examinadas</dt><dd>{fmtNum(r.resumo.chavesExaminadas)}</dd>
        <dt>documentos retornados</dt><dd>{fmtNum(r.resumo.documentosRetornados)}</dd>
        <dt>tempo no servidor</dt><dd>{r.resumo.tempoMs} ms</dd>
      </dl>
      <details className="pipeline"><summary>Plano completo (winningPlan)</summary><JsonView data={r.planoCompleto} maxHeight={300} /></details>
    </div>
  );
  return (
    <div className="stack">
      <p className="muted">A mesma consulta duas vezes: forcando varredura completa (<code>hint({"{"} $natural: 1 {"}"})</code>) e deixando o planejador escolher o indice. Compare quantos documentos o servidor precisou ler.</p>
      <div className="row">
        <select className="input" style={{ width: "auto" }} value={field} onChange={(e) => setField(e.target.value)}>
          {["patientId", "specialty", "recordType", "tags", "diagnosis.cid10", "unit"].map((f) => <option key={f}>{f}</option>)}
        </select>
        <input className="input" style={{ width: 200 }} value={value} onChange={(e) => setValue(e.target.value)} placeholder="valor" />
        <span className="muted small">sort {"{"} occurredAt: -1 {"}"}</span>
        <button className="btn primary" disabled={busy} onClick={run}>{busy ? "Executando..." : "Comparar planos"}</button>
      </div>
      <ErrorBox error={error} />
      {runs && <div className="compare"><Box title="Sem indice (COLLSCAN forcado)" r={runs.sem} tone="bad" /><Box title="Com indice (planejador livre)" r={runs.com} tone="good" /></div>}
    </div>
  );
}

function Indexes() {
  const idx = useLoad(() => api.admin.indexes());
  if (idx.loading) return <Loading />;
  if (idx.error) return <ErrorBox error={idx.error} onRetry={idx.reload} />;
  return (
    <div className="grid cols-2">
      {Object.entries(idx.data.existentes).map(([col, list]) => (
        <div key={col}>
          <h3 style={{ marginBottom: 6 }}>{col}</h3>
          <table><thead><tr><th>Nome</th><th>Chave</th><th>Tipo</th></tr></thead>
            <tbody>{list.map((i) => <tr key={i.name}><td><code>{i.name}</code>{i.unique && <Badge tone="brand">unique</Badge>}</td><td><code>{JSON.stringify(i.key)}</code></td><td>{i.tipo}</td></tr>)}</tbody></table>
        </div>
      ))}
    </div>
  );
}

function Schema() {
  const sc = useLoad(() => api.admin.schema());
  const [collection, setCollection] = useState("atendimentos");
  const [doc, setDoc] = useState(INVALID_DOC);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  async function test() {
    setError(null); setResult(null);
    try {
      const body = JSON.parse(doc);
      setResult(await api.admin.validationDemo(body, collection));
    } catch (err) { setError(err.status ? err : { message: "JSON invalido: " + err.message }); }
  }
  return (
    <div className="grid cols-2">
      <div>
        <h3 style={{ marginBottom: 6 }}>Validators ($jsonSchema) das colecoes</h3>
        <p className="muted small" style={{ marginBottom: 8 }}>Schema flexivel nao e ausencia de schema: o servidor valida os invariantes (tipos, enums, GeoJSON, CID-10) e deixa clinicalData livre.</p>
        {sc.loading ? <Loading /> : sc.error ? <ErrorBox error={sc.error} /> : <JsonView data={sc.data} maxHeight={560} />}
      </div>
      <div className="stack">
        <h3>Testar a validacao</h3>
        <p className="muted small">Envie um documento: se for rejeitado, o Mongo devolve exatamente quais regras falharam. Documentos validos sao inseridos e removidos em seguida.</p>
        <div className="row"><select className="input" style={{ width: "auto" }} value={collection} onChange={(e) => setCollection(e.target.value)}><option>atendimentos</option><option>prontuarios</option></select><button className="btn primary" onClick={test}>Tentar inserir</button><button className="btn sm ghost" onClick={() => setDoc(INVALID_DOC)}>restaurar exemplo</button></div>
        <textarea className="input" style={{ minHeight: 180, fontFamily: "monospace", fontSize: 12.5 }} value={doc} onChange={(e) => setDoc(e.target.value)} />
        <ErrorBox error={error} />
        {result && (
          <div>
            <div className={`alert ${result.rejeitado ? "error" : "info"}`}>{result.rejeitado ? `Rejeitado (erro ${result.codigo}): ${result.mensagem}` : result.mensagem}</div>
            {result.detalhes && <JsonView data={result.detalhes} maxHeight={360} />}
          </div>
        )}
      </div>
    </div>
  );
}

function Sample() {
  const [collection, setCollection] = useState("atendimentos");
  const [specialty, setSpecialty] = useState("");
  const s = useLoad(() => api.admin.sample(collection, { specialty }), [collection, specialty]);
  return (
    <div className="stack">
      <div className="row">
        <select className="input" style={{ width: "auto" }} value={collection} onChange={(e) => setCollection(e.target.value)}><option>atendimentos</option><option>prontuarios</option></select>
        {collection === "atendimentos" && <select className="input" style={{ width: "auto" }} value={specialty} onChange={(e) => setSpecialty(e.target.value)}><option value="">qualquer especialidade</option>{["Cardiologia", "Oftalmologia", "Ortopedia", "Psiquiatria", "Endocrinologia", "Dermatologia", "Pediatria", "Clinica Geral", "Ginecologia", "Analises Clinicas", "Diagnostico por Imagem", "Imunizacao", "Cirurgia Geral"].map((x) => <option key={x}>{x}</option>)}</select>}
        <button className="btn sm" onClick={s.reload}>Outro documento ($sample)</button>
      </div>
      {s.loading ? <Loading /> : s.error ? <ErrorBox error={s.error} /> : <JsonView data={s.data} maxHeight={600} />}
    </div>
  );
}

function SearchIndexes() {
  const si = useLoad(() => api.admin.searchIndexes());
  const [msg, setMsg] = useState(null);
  return (
    <div className="stack">
      <div className="row"><button className="btn" onClick={() => api.admin.createSearchIndexes().then((r) => { setMsg(r); si.reload(); })}>Criar indices do Atlas Search (se faltarem)</button>{si.data && <Badge tone={si.data.atlas ? "mongo" : "warn"}>{si.data.atlas ? "cluster Atlas" : "nao e Atlas: sem Search"}</Badge>}</div>
      {msg && <JsonView data={msg} maxHeight={200} />}
      {si.loading ? <Loading /> : si.error ? <ErrorBox error={si.error} /> : <JsonView data={si.data.indices} maxHeight={500} />}
    </div>
  );
}

function Seed() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  async function reseed() {
    if (!window.confirm("Isso apaga prontuarios e atendimentos no Atlas e recarrega os 120 pacientes da demo. Continuar?")) return;
    setBusy(true); setError(null);
    try { setResult(await api.admin.seed(true)); } catch (err) { setError(err); } finally { setBusy(false); }
  }
  return (
    <div className="stack">
      <p className="muted">Recria a carga inicial (deterministica) a partir de infra/seed/patients.json. Util para voltar ao estado original depois de uma demonstracao.</p>
      <div className="row"><button className="btn danger" disabled={busy} onClick={reseed}>{busy ? "Recarregando..." : "Recarregar dados da demo (force)"}</button></div>
      <ErrorBox error={error} />
      {result && <JsonView data={result} maxHeight={240} />}
    </div>
  );
}

export default function MongoLab() {
  const [tab, setTab] = useState("overview");
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Bastidores do MongoDB</h1>
          <p>O que o Atlas faz por baixo das telas: plano de execucao com e sem indice, indices declarados, schema validation em acao, documentos crus e o estado dos indices de busca.</p>
        </div>
        <Badge tone="mongo">medical-record-service · /admin</Badge>
      </div>
      <Card>
        <Tabs active={tab} onChange={setTab} tabs={[{ id: "overview", label: "Visao geral" }, { id: "explain", label: "Explain: com vs. sem indice" }, { id: "indexes", label: "Indices" }, { id: "schema", label: "Schema validation" }, { id: "sample", label: "Documento cru" }, { id: "search", label: "Atlas Search" }, { id: "seed", label: "Seed" }]} />
        {tab === "overview" && <Overview />}
        {tab === "explain" && <Explain />}
        {tab === "indexes" && <Indexes />}
        {tab === "schema" && <Schema />}
        {tab === "sample" && <Sample />}
        {tab === "search" && <SearchIndexes />}
        {tab === "seed" && <Seed />}
      </Card>
    </>
  );
}
