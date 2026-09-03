import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { Badge, Card, Empty, ErrorBox, Loading, useLoad } from "../components/ui.jsx";
import JsonView from "../components/JsonView.jsx";
import PipelineViewer from "../components/PipelineViewer.jsx";
import { fmtDate, TYPE_LABEL, TYPE_TONE } from "../lib/format.js";

const EXAMPLES = ["dor de cabeça", "hipertensao", "palpitacoes", "Losartana", "insonia", "Vasconcelos", "torceu o tornozelo", "diabetis"];

// Converte o formato de highlights do Atlas Search em JSX com <mark>.
function Highlight({ h }) {
  return <span>{h.texts.map((t, i) => (t.type === "hit" ? <mark key={i}>{t.value}</mark> : <span key={i}>{t.value}</span>))}</span>;
}

export default function Busca() {
  const [q, setQ] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [type, setType] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [suggest, setSuggest] = useState([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const timer = useRef(null);
  const status = useLoad(() => api.search.status());

  async function run(term = q, sp = specialty, tp = type) {
    if (term.trim().length < 2) return;
    setBusy(true); setError(null); setShowSuggest(false);
    try { setResult(await api.search.query(term, { specialty: sp || undefined, type: tp || undefined })); } catch (err) { setError(err); } finally { setBusy(false); }
  }

  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) { setSuggest([]); return; }
    timer.current = setTimeout(() => api.search.autocomplete(q).then((r) => setSuggest(r.results)).catch(() => setSuggest([])), 180);
    return () => clearTimeout(timer.current);
  }, [q]);

  const facetButtons = (name, key, current, setter) => {
    const buckets = result?.facets?.facet?.[name]?.buckets || [];
    if (!buckets.length) return null;
    return (
      <div>
        <h3 style={{ marginBottom: 4 }}>{name}</h3>
        <div className="facets">
          {buckets.map((b) => <button key={b._id} className={current === b._id ? "active" : ""} onClick={() => { const v = current === b._id ? "" : b._id; setter(v); run(q, key === "specialty" ? v : specialty, key === "type" ? v : type); }}><span>{b._id}</span><span className="muted">{b.count}</span></button>)}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Busca no prontuario</h1>
          <p>Atlas Search: full-text em portugues com tolerancia a erros de digitacao (fuzzy), autocomplete de nomes e facets. Quando o indice nao esta disponivel, o servico cai para $regex e avisa - compare os dois.</p>
        </div>
        <div className="row">
          {status.data && Object.values(status.data).map((s) => <Badge key={s.name} tone={s.queryable ? "mongo" : "warn"} title={s.reason || s.status}>{s.name}: {s.queryable ? "pronto" : s.status}</Badge>)}
        </div>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <form className="row" onSubmit={(e) => { e.preventDefault(); run(); }}>
          <div className="autocomplete" style={{ flex: 1, minWidth: 280 }}>
            <input className="input" placeholder="Sintoma, diagnostico, medicamento, profissional ou nome do paciente..." value={q} onChange={(e) => { setQ(e.target.value); setShowSuggest(true); }} onFocus={() => setShowSuggest(true)} onBlur={() => setTimeout(() => setShowSuggest(false), 150)} />
            {showSuggest && suggest.length > 0 && (
              <ul>
                {suggest.map((s) => <li key={s.patientId} onMouseDown={() => { window.location.assign(`/pacientes/${s.patientId}`); }}><span>{s.fullName}</span><span className="muted small">#{s.patientId} · {s.healthPlan}</span></li>)}
                <li className="muted small" style={{ cursor: "default" }}>autocomplete (edgeGram) sobre prontuarios.fullName</li>
              </ul>
            )}
          </div>
          <button className="btn primary" disabled={busy}>{busy ? "Buscando..." : "Buscar"}</button>
        </form>
        <div className="row" style={{ marginTop: 10 }}>
          <span className="muted small">Experimente:</span>
          {EXAMPLES.map((ex) => <button key={ex} className="btn sm ghost" onClick={() => { setQ(ex); run(ex); }}>{ex}</button>)}
        </div>
      </Card>

      <ErrorBox error={error} />

      {result && (
        <div className="grid" style={{ gridTemplateColumns: "220px 1fr" }}>
          <Card title="Facets" subtitle="$searchMeta conta por categoria">
            <div className="stack">
              {facetButtons("especialidade", "specialty", specialty, setSpecialty)}
              {facetButtons("tipo", "type", type, setType)}
              {facetButtons("unidade", "unit", "", () => {})}
              {!result.facets && <p className="muted small">Facets so existem no Atlas Search.</p>}
              {(specialty || type) && <button className="btn sm" onClick={() => { setSpecialty(""); setType(""); run(q, "", ""); }}>Limpar filtros</button>}
            </div>
          </Card>
          <Card
            title={`${result.total} resultado${result.total === 1 ? "" : "s"} para "${result.q}"`}
            subtitle={result.engine === "atlas-search" ? "Ordenado por relevancia (searchScore), com trechos destacados." : `Fallback por expressao regular: ${result.reason || "Atlas Search indisponivel"}. Sem ranking, sem fuzzy, sem destaque.`}
            actions={<><Badge tone={result.engine === "atlas-search" ? "mongo" : "warn"}>{result.engine}</Badge><Badge>{result.tookMs} ms</Badge></>}
          >
            {result.results.length === 0 ? <Empty>Nada encontrado.</Empty> : (
              <div className="timeline">
                {result.results.map((r) => (
                  <div key={r._id} className="tl-item">
                    <div className="when"><b>{fmtDate(r.occurredAt)}</b>{r.score != null && <span title="searchScore">score {r.score.toFixed(2)}</span>}</div>
                    <div>
                      <div className="title"><Badge tone={TYPE_TONE[r.recordType]}>{TYPE_LABEL[r.recordType]}</Badge><Link to={`/pacientes/${r.patientId}`}><b>{r.patientName}</b></Link><span className="muted">{r.specialty} · {r.professional?.name}</span></div>
                      {r.highlights?.length ? r.highlights.slice(0, 3).map((h, i) => <div key={i} className="body"><span className="muted small">{h.path}: </span><Highlight h={h} /></div>) : (
                        <>{r.chiefComplaint && <div className="body">{r.chiefComplaint}</div>}{r.notes && <div className="body small">{r.notes}</div>}</>
                      )}
                      {r.diagnosis?.length > 0 && <div className="chips" style={{ marginTop: 4 }}>{r.diagnosis.map((d) => <span key={d.cid10} className="chip"><code>{d.cid10}</code> {d.description}</span>)}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <PipelineViewer report={{ ...result, collection: "atendimentos" }} label={result.engine === "atlas-search" ? "Ver o pipeline $search" : "Ver o filtro $regex usado no fallback"} />
          </Card>
        </div>
      )}

      {!result && status.data && (
        <Card title="Definicao dos indices do Atlas Search" subtitle="Criados pelo servico via createSearchIndexes(); se o cluster nao permitir, cole a definicao no painel do Atlas (Search > Create Index > JSON Editor).">
          <div className="grid cols-2">
            {Object.entries(status.data).map(([col, s]) => <div key={col}><h3>{col} → {s.name} <Badge tone={s.queryable ? "ok" : "warn"}>{s.status}</Badge></h3><JsonView data={s.definition || s.expectedDefinition} maxHeight={360} /></div>)}
          </div>
        </Card>
      )}
      {!result && status.loading && <Loading />}
    </>
  );
}
