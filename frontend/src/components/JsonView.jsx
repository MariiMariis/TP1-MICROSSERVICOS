// Mostra um JSON com destaque de sintaxe. Usado para exibir documentos, pipelines e planos.
function highlight(json) {
  const escaped = json.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return escaped.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false)\b|\bnull\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (m) => {
      let cls = "n";
      if (m.startsWith('"')) cls = m.endsWith(":") ? "k" : "s";
      else if (m === "true" || m === "false") cls = "b";
      else if (m === "null") cls = "z";
      return `<span class="${cls}">${m}</span>`;
    },
  );
}

export default function JsonView({ data, maxHeight }) {
  const json = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return <pre className="json" style={maxHeight ? { maxHeight } : undefined} dangerouslySetInnerHTML={{ __html: highlight(json ?? "null") }} />;
}
