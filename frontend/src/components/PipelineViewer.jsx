import JsonView from "./JsonView.jsx";

// "A consulta que gerou este resultado": mostra o pipeline/filtro que o servico enviou ao Mongo.
export default function PipelineViewer({ report, label = "Ver o aggregation pipeline", method = "aggregate" }) {
  if (!report?.pipeline) return null;
  const collection = report.collection || "atendimentos";
  return (
    <details className="pipeline">
      <summary>{label}</summary>
      {report.description && <div className="meta">{report.description}</div>}
      <div className="meta">
        db.<b>{collection}</b>.{method}(...) · {report.pipeline.length} estagio{report.pipeline.length === 1 ? "" : "s"}
        {report.tookMs != null && <> · executado em <b>{report.tookMs} ms</b></>}
      </div>
      <JsonView data={report.pipeline} />
    </details>
  );
}
