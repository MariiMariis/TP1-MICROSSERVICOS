import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Badge, ErrorBox, Loading } from "./ui.jsx";
import JsonView from "./JsonView.jsx";
import { explainStage, PLAN_STAGES } from "../lib/stageExplainer.js";
import { fmtNum } from "../lib/format.js";

// Botao "Como o Atlas processou" + painel lateral com o pipeline explicado e o explain real.
export function AtlasExplainButton({ report, params }) {
  const [open, setOpen] = useState(false);
  if (!report?.key) return null;
  return (
    <>
      <button className="btn sm atlas" onClick={() => setOpen(true)} title="Mostra o pipeline explicado e o plano de execucao real desta consulta">🍃 Como o Atlas processou</button>
      {open && <AtlasExplainDrawer report={report} params={params} onClose={() => setOpen(false)} />}
    </>
  );
}

function Metric({ label, value, hint }) {
  return (
    <div className="metric">
      <div className="label">{label}</div>
      <div className="value">{value ?? "—"}</div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function AtlasExplainDrawer({ report, params, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("pipeline");

  useEffect(() => {
    let alive = true;
    api.analytics.explain(report.key, params).then((d) => alive && setData(d)).catch((e) => alive && setError(e));
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { alive = false; window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [report.key, params, onClose]);

  const pipeline = report.pipeline || data?.pipeline || [];
  const r = data?.resumo;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <header className="drawer-head">
          <div>
            <div className="row"><Badge tone="mongo">MongoDB Atlas</Badge><span className="muted small">db.{report.collection}.aggregate(...)</span></div>
            <h2 style={{ marginTop: 6 }}>{report.title}</h2>
            {report.description && <p className="muted small" style={{ marginTop: 4 }}>{report.description}</p>}
          </div>
          <button className="btn ghost" onClick={onClose} aria-label="Fechar">✕</button>
        </header>

        {error && <ErrorBox error={error} />}
        {!data && !error && <Loading text="Executando explain('executionStats') no Atlas..." />}

        {data && (
          <>
            <div className="metrics">
              <Metric label="Executado no no" value={data.servidor?.host?.split(".")[0] ?? "?"} hint={data.servidor ? `MongoDB ${data.servidor.version} · ${data.servidor.host?.split(".").slice(1).join(".")}` : null} />
              <Metric label="Documentos lidos da colecao" value={fmtNum(r.documentosLidos)} hint={r.varreuColecaoInteira ? "varredura completa (COLLSCAN)" : "leitura por indice"} />
              <Metric label="Chaves de indice lidas" value={fmtNum(r.chavesDeIndiceLidas)} hint={r.indicesUsados.length ? `indices envolvidos: ${r.indicesUsados.join(", ")}` : "nenhum indice"} />
              <Metric label="Documentos devolvidos" value={fmtNum(r.documentosDevolvidos)} hint={`${r.estagiosExecutados} estagio${r.estagiosExecutados === 1 ? "" : "s"} executado${r.estagiosExecutados === 1 ? "" : "s"}`} />
              <Metric label="Tempo no servidor" value={`${r.tempoServidorMs} ms`} hint={`${data.tempoIdaEVoltaMs} ms ida e volta ate aqui`} />
            </div>
            {r.varreuColecaoInteira && (
              <div className="alert info small" style={{ marginTop: 10 }}>
                Esta analise agrega a colecao inteira, entao a varredura completa e o plano correto: um indice so ajudaria se houvesse um $match seletivo no inicio. Compare com a aba <b>Explain</b> em Bastidores, onde a consulta pontual por paciente le 14 documentos em vez de {fmtNum(r.documentosLidos)}.
              </div>
            )}

            <div className="tabs" style={{ marginTop: 14 }}>
              <button className={tab === "pipeline" ? "active" : ""} onClick={() => setTab("pipeline")}>1. O que pedimos ({pipeline.length} estagios)</button>
              <button className={tab === "exec" ? "active" : ""} onClick={() => setTab("exec")}>2. O que o servidor fez ({data.estagios.length})</button>
              <button className={tab === "raw" ? "active" : ""} onClick={() => setTab("raw")}>3. explain() bruto</button>
            </div>

            {tab === "pipeline" && (
              <ol className="steps">
                {pipeline.map((stage, i) => {
                  const name = Object.keys(stage)[0];
                  const ex = explainStage(stage);
                  return (
                    <li key={i} className="step">
                      <div className="step-head"><span className="step-n">{i + 1}</span><code className="step-name">{name}</code><b>{ex.title}</b></div>
                      <p>{ex.text}</p>
                      {ex.detail && <p className="muted small">{ex.detail}</p>}
                      <details><summary className="muted small">ver o estagio como enviado</summary><JsonView data={stage} maxHeight={220} /></details>
                    </li>
                  );
                })}
              </ol>
            )}

            {tab === "exec" && (
              <div className="stack">
                <p className="muted small">O otimizador reorganiza o pipeline: $match, $sort e $project iniciais viram a leitura da colecao ($cursor) e, em versoes recentes, estagios inteiros sao compilados no motor de execucao. Por isso a lista abaixo pode ter menos itens que o pipeline enviado.</p>
                <ol className="steps">
                  {data.estagios.map((s, i) => (
                    <li key={i} className="step">
                      <div className="step-head"><span className="step-n">{i + 1}</span><code className="step-name">{s.stage}</code>
                        {s.nReturned != null && <Badge>{fmtNum(s.nReturned)} doc{s.nReturned === 1 ? "" : "s"} de saida</Badge>}
                        {s.ms != null && <Badge>{s.ms} ms</Badge>}
                        {s.docsExamined != null && <Badge tone="warn">{fmtNum(s.docsExamined)} docs lidos</Badge>}
                        {s.keysExamined != null && s.keysExamined > 0 && <Badge tone="ok">{fmtNum(s.keysExamined)} chaves de indice</Badge>}
                        {s.usedDisk && <Badge tone="danger">usou disco</Badge>}
                        {s.memoriaBytes != null && <Badge>{fmtNum(Math.round(s.memoriaBytes / 1024))} KB em memoria</Badge>}
                      </div>
                      {s.descricao && <p className="muted small">{s.descricao}</p>}
                      {s.filtro && <p className="small">Filtro aplicado na leitura: <code>{JSON.stringify(s.filtro)}</code></p>}
                      {s.indexesUsed?.length > 0 && <p className="small">Indices usados no join: {s.indexesUsed.join(", ")}</p>}
                      {s.plano?.length > 0 && (
                        <div className="plan">
                          {[...s.plano].reverse().map((p, j) => {
                            const info = PLAN_STAGES[p.stage] || { label: p.stage, text: "", tone: "" };
                            return (
                              <div key={j} className="plan-node">
                                <Badge tone={info.tone}>{p.stage}</Badge>
                                <div><b>{info.label}</b>{p.indexName && <> · <code>{p.indexName}</code></>}<div className="muted small">{info.text}</div></div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
                {data.motor && <p className="muted small">Motor de consulta: <code>{data.motor}</code></p>}
              </div>
            )}

            {tab === "raw" && <JsonView data={data.bruto} maxHeight={640} />}
          </>
        )}
      </aside>
    </div>
  );
}
