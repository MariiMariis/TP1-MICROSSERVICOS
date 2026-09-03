// Turns the output of aggregate(...).explain("executionStats") into a readable digest.
//
// The server can answer in two shapes:
//   a) "stages": [ { $cursor: {...} }, { $group: {...} }, ... ]  - classic pipeline, stage by stage
//   b) no "stages", with queryPlanner/executionStats at the root  - whole pipeline "pushed down" to
//      the execution engine (SBE), as happens in 8.0 with $group/$project over the collection
// Both become the same structure.

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

// Per-stage statistics of the executed plan (COLLSCAN, IXSCAN, GROUP...), when available.
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
        stages.push({ stage: "$cursor", description: "Collection read (leading $match/$sort/$project are merged here)", filter: qp?.parsedQuery ?? null, plan, ...(cursorStats || {}) });
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
          ...(st.maxAccumulatorMemoryUsageBytes ? { memoryBytes: Object.values(st.maxAccumulatorMemoryUsageBytes).reduce((a, b) => a + b, 0) } : {}),
        });
      }
    }
  } else if (explain.queryPlanner) {
    const qp = explain.queryPlanner;
    const es = explain.executionStats;
    plan = planChain(qp.winningPlan);
    cursorStats = es ? { nReturned: es.nReturned, docsExamined: es.totalDocsExamined, keysExamined: es.totalKeysExamined, ms: es.executionTimeMillis, planExec: execChain(es.executionStages) } : null;
    stages.push({ stage: "single plan", description: "The whole pipeline was compiled into one plan by the execution engine (pushdown), with no intermediate stages", plan, ...(cursorStats || {}) });
  }

  const indexes = [...new Set([...plan.filter((p) => p.indexName).map((p) => p.indexName), ...stages.flatMap((s) => s.indexesUsed || [])])];
  const collscan = plan.some((p) => p.stage === "COLLSCAN");
  const msTotal = stages.reduce((acc, s) => Math.max(acc, s.ms ?? 0), 0);

  return {
    server,
    engine,
    summary: {
      stagesExecuted: stages.length,
      fullCollectionScan: collscan,
      indexesUsed: indexes,
      docsExamined: cursorStats?.docsExamined ?? null,
      keysExamined: cursorStats?.keysExamined ?? null,
      docsReturned: stages.length ? stages[stages.length - 1].nReturned ?? null : null,
      serverTimeMs: msTotal,
    },
    stages,
  };
}
