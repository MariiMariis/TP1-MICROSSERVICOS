// Translates each stage of an aggregation pipeline into a plain-English sentence.
// Receives the stage as it came from the service (e.g. { $group: { _id: "$specialty", total: { $sum: 1 } } }).

const short = (v) => {
  const s = JSON.stringify(v);
  return s.length > 90 ? s.slice(0, 87) + "..." : s;
};
const keys = (o) => Object.keys(o || {});
const fieldName = (v) => (typeof v === "string" && v.startsWith("$") ? v.slice(1) : short(v));

const ACCUM = { $sum: "sum", $avg: "average", $min: "minimum", $max: "maximum", $first: "first value", $last: "last value", $push: "list", $addToSet: "set (no duplicates)", $count: "count" };

function describeAccumulators(group) {
  return keys(group).filter((k) => k !== "_id").map((k) => {
    const op = keys(group[k])[0];
    const label = ACCUM[op] || op;
    const arg = group[k][op];
    return `${k} = ${label}${arg === 1 ? " of 1 per document (a count)" : typeof arg === "string" ? ` of ${arg}` : ""}`;
  });
}

export function explainStage(stage) {
  const name = Object.keys(stage)[0];
  const body = stage[name];
  switch (name) {
    case "$match":
      return { title: "Filters documents", text: `Only documents matching ${short(body)} pass through. When it is the first stage, the server can use indexes for it.` };
    case "$group":
      return { title: `Groups by ${body._id === null ? "all documents (a single group)" : fieldName(body._id)}`, text: `For each group it computes: ${describeAccumulators(body).join("; ")}.`, detail: "Equivalent to SQL's GROUP BY, but accumulators can build arrays and sets, not just numbers." };
    case "$project":
      return { title: "Selects and renames fields", text: `Output with the fields ${keys(body).join(", ")}; anything not listed is dropped, and expressions compute new values.` };
    case "$addFields":
    case "$set":
      return { title: "Computes new fields", text: `Adds ${keys(body).join(", ")} to each document without removing the existing ones.`, detail: JSON.stringify(body).includes("$dateDiff") ? "$dateDiff computes the age from the birth date at query time: there is no stored 'age' field." : undefined };
    case "$sort":
      return { title: "Sorts", text: `By ${keys(body).map((k) => `${k} ${body[k] === -1 ? "descending" : "ascending"}`).join(", ")}.`, detail: "If an index provides this order, the server reads the documents already sorted and avoids an in-memory SORT stage." };
    case "$limit":
      return { title: `Keeps the first ${body}`, text: "Cuts the stream, so the following stages process fewer documents." };
    case "$skip":
      return { title: `Skips the first ${body}`, text: "Used with $limit for pagination." };
    case "$unwind":
      return { title: `Unwinds the array ${fieldName(typeof body === "string" ? body : body.path)}`, text: "Each array element becomes its own document, which allows grouping and counting embedded items (diagnoses, medications, allergies) with no join table." };
    case "$lookup":
      return { title: `Joins with the ${body.from} collection`, text: body.localField ? `Links ${body.localField} here with ${body.foreignField} in ${body.from} and puts the matching documents in the ${body.as} array.` : `Runs a sub-pipeline on ${body.from} for each document and stores the result in ${body.as}.`, detail: "This is MongoDB's join. There is no foreign key: the link is logical, made in the query." };
    case "$facet":
      return { title: `Runs ${keys(body).length} analyses in one pass`, text: `Sub-pipelines ${keys(body).join(", ")} run over the same input documents and each returns its own array.`, detail: "A single collection access feeds several indicators: this is what allows building a whole panel with one query." };
    case "$bucket":
      return { title: `Distributes ${fieldName(body.groupBy)} into ranges`, text: `Boundaries ${JSON.stringify(body.boundaries)}; for each range it computes ${keys(body.output || {}).join(", ")}.` };
    case "$bucketAuto":
      return { title: `Distributes ${fieldName(body.groupBy)} into ${body.buckets} automatic ranges`, text: "The server picks the boundaries to balance the count per range." };
    case "$count":
      return { title: "Counts documents", text: `Returns the count in the field ${body}.` };
    case "$geoNear":
      return { title: "Sorts by geographic distance", text: `From the point ${JSON.stringify(body.near?.coordinates)}, using the 2dsphere index on ${body.key}; stores the distance in ${body.distanceField}${body.maxDistance ? ` and limits it to ${body.maxDistance} m` : ""}.` };
    case "$search":
      return { title: "Full-text search in Atlas Search", text: `Queries the Lucene index ${body.index}, outside mongod, and returns documents by relevance.` };
    case "$searchMeta":
      return { title: "Search metadata (facets)", text: "Counts results per category without fetching the documents." };
    case "$sample":
      return { title: `Picks ${body.size} random document(s)`, text: "A random sample of the collection." };
    case "$replaceRoot":
    case "$replaceWith":
      return { title: "Replaces the document root", text: `The document becomes ${short(body)}.` };
    default:
      return { title: name, text: short(body) };
  }
}

// Execution plan stage name -> short explanation.
export const PLAN_STAGES = {
  COLLSCAN: { label: "Collection scan", text: "Read every document. Normal for analyses that aggregate the whole collection; bad for point queries.", tone: "warn" },
  IXSCAN: { label: "Index scan", text: "Walked only the index keys that match the filter.", tone: "ok" },
  FETCH: { label: "Document fetch", text: "Loaded the full document from the key found in the index.", tone: "" },
  SORT: { label: "In-memory sort", text: "No index provided the requested order.", tone: "warn" },
  GROUP: { label: "Grouping (SBE engine)", text: "The $group was compiled straight into the execution plan.", tone: "ok" },
  PROJECTION_DEFAULT: { label: "Projection", text: "Selects fields.", tone: "" },
  PROJECTION_SIMPLE: { label: "Projection", text: "Selects fields.", tone: "" },
  PROJECTION_COVERED: { label: "Covered projection", text: "Everything came from the index, no documents read.", tone: "ok" },
  LIMIT: { label: "Limit", text: "Cuts the stream.", tone: "" },
  SKIP: { label: "Skip", text: "Discards the first documents.", tone: "" },
  GEO_NEAR_2DSPHERE: { label: "Geospatial search", text: "Used the 2dsphere index.", tone: "ok" },
  UNWIND: { label: "Unwind", text: "Opens arrays.", tone: "" },
  EQ_LOOKUP: { label: "Join", text: "Executes the $lookup.", tone: "" },
  SUBPLAN: { label: "Sub-plans", text: "Each $or branch got its own plan.", tone: "" },
};
