// Traduz cada estagio de um aggregation pipeline para uma frase em portugues.
// Recebe o estagio como veio do servico (ex.: { $group: { _id: "$specialty", total: { $sum: 1 } } }).

const short = (v) => {
  const s = JSON.stringify(v);
  return s.length > 90 ? s.slice(0, 87) + "..." : s;
};
const keys = (o) => Object.keys(o || {});
const fieldName = (v) => (typeof v === "string" && v.startsWith("$") ? v.slice(1) : short(v));

const ACCUM = { $sum: "soma", $avg: "media", $min: "minimo", $max: "maximo", $first: "primeiro valor", $last: "ultimo valor", $push: "lista", $addToSet: "conjunto (sem repeticao)", $count: "contagem" };

function describeAccumulators(group) {
  return keys(group).filter((k) => k !== "_id").map((k) => {
    const op = keys(group[k])[0];
    const label = ACCUM[op] || op;
    const arg = group[k][op];
    return `${k} = ${label}${arg === 1 ? " de 1 por documento (contagem)" : typeof arg === "string" ? ` de ${arg}` : ""}`;
  });
}

export function explainStage(stage) {
  const name = Object.keys(stage)[0];
  const body = stage[name];
  switch (name) {
    case "$match":
      return { title: "Filtra documentos", text: `So passam os documentos que atendem ${short(body)}. Quando e o primeiro estagio, o servidor consegue usar indices para isso.` };
    case "$group":
      return { title: `Agrupa por ${body._id === null ? "todos os documentos (um grupo so)" : fieldName(body._id)}`, text: `Para cada grupo calcula: ${describeAccumulators(body).join("; ")}.`, detail: "Equivale ao GROUP BY do SQL, mas os acumuladores podem montar arrays e conjuntos, nao so numeros." };
    case "$project":
      return { title: "Escolhe e renomeia campos", text: `Saida com os campos ${keys(body).join(", ")}; o que nao esta aqui e descartado, e expressoes calculam novos valores.` };
    case "$addFields":
    case "$set":
      return { title: "Calcula campos novos", text: `Acrescenta ${keys(body).join(", ")} a cada documento, sem remover os existentes.`, detail: JSON.stringify(body).includes("$dateDiff") ? "$dateDiff calcula a idade a partir da data de nascimento no momento da consulta: nao existe campo 'idade' gravado." : undefined };
    case "$sort":
      return { title: "Ordena", text: `Por ${keys(body).map((k) => `${k} ${body[k] === -1 ? "decrescente" : "crescente"}`).join(", ")}.`, detail: "Se houver um indice com essa ordem, o servidor le os documentos ja ordenados e evita o estagio SORT em memoria." };
    case "$limit":
      return { title: `Mantem os primeiros ${body}`, text: "Corta o fluxo, entao os estagios seguintes processam menos documentos." };
    case "$skip":
      return { title: `Pula os primeiros ${body}`, text: "Usado com $limit para paginacao." };
    case "$unwind":
      return { title: `Desmembra o array ${fieldName(typeof body === "string" ? body : body.path)}`, text: "Cada elemento do array vira um documento proprio, o que permite agrupar e contar itens embutidos (diagnosticos, medicamentos, alergias) sem tabela de associacao." };
    case "$lookup":
      return { title: `Junta com a colecao ${body.from}`, text: body.localField ? `Liga ${body.localField} daqui com ${body.foreignField} de ${body.from} e coloca os documentos encontrados no array ${body.as}.` : `Executa um sub-pipeline em ${body.from} para cada documento e guarda o resultado em ${body.as}.`, detail: "E o join do MongoDB. Nao existe chave estrangeira: a ligacao e logica, feita na consulta." };
    case "$facet":
      return { title: `Executa ${keys(body).length} analises em uma passada`, text: `Sub-pipelines ${keys(body).join(", ")} rodam sobre os mesmos documentos de entrada e cada um devolve seu proprio array.`, detail: "Um unico acesso a colecao alimenta varios indicadores: e o que permite montar um painel inteiro com uma consulta." };
    case "$bucket":
      return { title: `Distribui em faixas de ${fieldName(body.groupBy)}`, text: `Limites ${JSON.stringify(body.boundaries)}; para cada faixa calcula ${keys(body.output || {}).join(", ")}.` };
    case "$bucketAuto":
      return { title: `Distribui ${fieldName(body.groupBy)} em ${body.buckets} faixas automaticas`, text: "O servidor escolhe os limites para equilibrar a quantidade por faixa." };
    case "$count":
      return { title: "Conta documentos", text: `Devolve a quantidade no campo ${body}.` };
    case "$geoNear":
      return { title: "Ordena por distancia geografica", text: `A partir do ponto ${JSON.stringify(body.near?.coordinates)}, usando o indice 2dsphere em ${body.key}; grava a distancia em ${body.distanceField}${body.maxDistance ? ` e limita a ${body.maxDistance} m` : ""}.` };
    case "$search":
      return { title: "Busca full-text no Atlas Search", text: `Consulta o indice Lucene ${body.index}, fora do mongod, e devolve os documentos por relevancia.` };
    case "$searchMeta":
      return { title: "Metadados da busca (facets)", text: "Conta os resultados por categoria sem trazer os documentos." };
    case "$sample":
      return { title: `Sorteia ${body.size} documento(s)`, text: "Amostra aleatoria da colecao." };
    case "$replaceRoot":
    case "$replaceWith":
      return { title: "Troca a raiz do documento", text: `O documento passa a ser ${short(body)}.` };
    default:
      return { title: name, text: short(body) };
  }
}

// Nome do estagio de plano de execucao -> explicacao curta.
export const PLAN_STAGES = {
  COLLSCAN: { label: "Varredura da colecao", text: "Leu todos os documentos. Normal em analises que agregam a colecao inteira; ruim em consultas pontuais.", tone: "warn" },
  IXSCAN: { label: "Leitura por indice", text: "Percorreu apenas as chaves do indice que atendem ao filtro.", tone: "ok" },
  FETCH: { label: "Busca do documento", text: "Carregou o documento completo a partir da chave encontrada no indice.", tone: "" },
  SORT: { label: "Ordenacao em memoria", text: "Nenhum indice fornecia a ordem pedida.", tone: "warn" },
  GROUP: { label: "Agrupamento (motor SBE)", text: "O $group foi compilado direto no plano de execucao.", tone: "ok" },
  PROJECTION_DEFAULT: { label: "Projecao", text: "Seleciona campos.", tone: "" },
  PROJECTION_SIMPLE: { label: "Projecao", text: "Seleciona campos.", tone: "" },
  PROJECTION_COVERED: { label: "Projecao coberta", text: "Tudo veio do indice, sem ler documentos.", tone: "ok" },
  LIMIT: { label: "Limite", text: "Corta o fluxo.", tone: "" },
  SKIP: { label: "Pulo", text: "Descarta os primeiros documentos.", tone: "" },
  GEO_NEAR_2DSPHERE: { label: "Busca geoespacial", text: "Usou o indice 2dsphere.", tone: "ok" },
  UNWIND: { label: "Desmembramento", text: "Abre arrays.", tone: "" },
  EQ_LOOKUP: { label: "Join", text: "Executa o $lookup.", tone: "" },
  SUBPLAN: { label: "Sub-planos", text: "Cada ramo do $or ganhou um plano.", tone: "" },
};
