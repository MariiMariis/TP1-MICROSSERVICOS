// Transforma a saida de aggregate(...).explain("executionStats") em um resumo legivel.
//
// O servidor pode responder de duas formas:
//   a) "stages": [ { $cursor: {...} }, { $group: {...} }, ... ]  - pipeline classico, estagio a estagio
//   b) sem "stages", com queryPlanner/executionStats na raiz     - pipeline inteiro "empurrado" para o
//      motor de execucao (SBE), como acontece em 8.0 com $group/$project sobre a colecao
// Os dois casos viram a mesma estrutura.

function planChain(plan) {
  const out = [];
  let node = plan?.queryPlan || plan;
  while (node) {
    out.push({
      stage: node.stage,
      ...(node.indexName ? { indexName: node.indexName } : {}),
      ...(node.keyPattern ? { keyPattern: node.keyPattern } : {}),
      ...(node.direction ? { direction: node.direction } : {}),
    });
    node = node.inputStage || node.inputStages?.[0];
  }
  return out;
}

// Estatisticas por estagio do plano executado (COLLSCAN, IXSCAN, GROUP...), quando disponiveis.
function execChain(execStage) {
  const out = [];
  let node = execStage;
  while (node) {
    out.push({ stage: node.stage, nReturned: node.nReturned, ms: node.executionTimeMillisEstimate, docsExamined: node.docsExamined, keysExamined: node.keysExamined, ...(node.indexName ? { indexName: node.indexName } : {}) });
    node = node.inputStage || node.inputStages?.[0];
  }
  return out;
}

export function digestExplain(explain) {
  const server = explain.serverInfo ? { host: explain.serverInfo.host, version: explain.serverInfo.version } : null;
  const engine = explain.serverParameters?.internalQueryFrameworkControl ?? null;
  const stages = [];
  let plan = [];
  let cursorStats = null;

  if (Array.isArray(explain.stages)) {
    for (const st of explain.stages) {
      const name = Object.keys(st).find((k) => k.startsWith("$"));
      const body = st[name];
      if (name === "$cursor") {
        const qp = body.queryPlanner;
        const es = body.executionStats;
        plan = planChain(qp?.winningPlan);
        cursorStats = es ? { nReturned: es.nReturned, docsExamined: es.totalDocsExamined, keysExamined: es.totalKeysExamined, ms: es.executionTimeMillis, planExec: execChain(es.executionStages) } : null;
        stages.push({ stage: "$cursor", descricao: "Leitura da colecao (o $match/$sort/$project iniciais sao fundidos aqui)", filtro: qp?.parsedQuery ?? null, plano: plan, ...(cursorStats || {}) });
      } else {
        stages.push({
          stage: name,
          nReturned: st.nReturned,
          ms: st.executionTimeMillisEstimate,
          ...(st.totalDocsExamined != null ? { docsExamined: st.totalDocsExamined } : {}),
          ...(st.totalKeysExamined != null ? { keysExamined: st.totalKeysExamined } : {}),
          ...(st.indexesUsed ? { indexesUsed: st.indexesUsed } : {}),
          ...(st.usedDisk != null ? { usedDisk: st.usedDisk } : {}),
          ...(st.spilledRecords != null ? { spilledRecords: st.spilledRecords } : {}),
          ...(st.maxAccumulatorMemoryUsageBytes ? { memoriaBytes: Object.values(st.maxAccumulatorMemoryUsageBytes).reduce((a, b) => a + b, 0) } : {}),
        });
      }
    }
  } else if (explain.queryPlanner) {
    const qp = explain.queryPlanner;
    const es = explain.executionStats;
    plan = planChain(qp.winningPlan);
    cursorStats = es ? { nReturned: es.nReturned, docsExamined: es.totalDocsExamined, keysExamined: es.totalKeysExamined, ms: es.executionTimeMillis, planExec: execChain(es.executionStages) } : null;
    stages.push({ stage: "plano unico", descricao: "O pipeline inteiro foi compilado em um plano so pelo motor de execucao (pushdown), sem estagios intermediarios", plano: plan, ...(cursorStats || {}) });
  }

  const indices = [...new Set([...plan.filter((p) => p.indexName).map((p) => p.indexName), ...stages.flatMap((s) => s.indexesUsed || [])])];
  const collscan = plan.some((p) => p.stage === "COLLSCAN");
  const msTotal = stages.reduce((acc, s) => Math.max(acc, s.ms ?? 0), 0);
  const docsExamined = cursorStats?.docsExamined ?? null;
  const keysExamined = cursorStats?.keysExamined ?? null;

  return {
    servidor: server,
    motor: engine,
    resumo: {
      estagiosExecutados: stages.length,
      varreuColecaoInteira: collscan,
      indicesUsados: indices,
      documentosLidos: docsExamined,
      chavesDeIndiceLidas: keysExamined,
      documentosDevolvidos: stages.length ? stages[stages.length - 1].nReturned ?? null : null,
      tempoServidorMs: msTotal,
    },
    estagios: stages,
  };
}
