// medical-record-service - MedFlow electronic medical record in Node.js + Express + MongoDB Atlas.
//
// Keeps the external contract of Delivery 1 (/api/medical-records/**, port 8083, Eureka
// registration) and adds the Atlas demo routes: patient records, search, analytics,
// geospatial and "behind the scenes" (explain, indexes, schema validation).
import cors from "cors";
import express from "express";
import { config } from "./config.js";
import { close, connect, ensureSchema, ensureSearchIndexes, isAtlas, searchState, serverInfo } from "./db.js";
import { errorHandler } from "./errors.js";
import { startEureka } from "./eureka.js";
import { adminRouter } from "./routes/admin.js";
import { analyticsRouter } from "./routes/analytics.js";
import { encountersRouter } from "./routes/encounters.js";
import { geoRouter } from "./routes/geo.js";
import { recordsRouter } from "./routes/records.js";
import { searchRouter } from "./routes/search.js";
import { seedDatabase } from "./seed/seed.js";

const app = express();
app.disable("x-powered-by");
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  const started = Date.now();
  res.on("finish", () => console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - started} ms)`));
  next();
});

// "actuator" endpoints, in the same shape as the Spring services, for Eureka and for 00-health.http.
app.get("/actuator/health", async (req, res) => {
  try {
    const info = await serverInfo();
    res.json({ status: "UP", components: { mongo: { status: "UP", details: info }, atlasSearch: searchState } });
  } catch (err) {
    res.status(503).json({ status: "DOWN", components: { mongo: { status: "DOWN", details: { error: err.message } } } });
  }
});
app.get("/actuator/info", (req, res) => {
  res.json({ app: { name: config.appName, responsibility: "Patient electronic medical record", database: `MongoDB ${isAtlas() ? "Atlas" : "local"} / ${config.mongoDb}`, runtime: `Node.js ${process.version}` } });
});
app.get("/", (req, res) => res.redirect("/actuator/info"));

// Order matters: the sub-paths come before the router that has /:id.
const base = "/api/medical-records";
app.get(`${base}/info`, (req, res) => res.json({ service: config.appName, port: String(config.port), database: `MongoDB Atlas / ${config.mongoDb}`, runtime: `Node.js ${process.version}` }));
app.use(`${base}/patients`, recordsRouter);
app.use(`${base}/search`, searchRouter);
app.use(`${base}/analytics`, analyticsRouter);
app.use(`${base}/geo`, geoRouter);
app.use(`${base}/admin`, adminRouter);
app.use(base, encountersRouter);

app.use((req, res) => res.status(404).json({ timestamp: new Date().toISOString(), status: 404, error: "Not Found", message: `Route ${req.method} ${req.originalUrl} does not exist`, path: req.originalUrl }));
app.use(errorHandler);

// ------------------------------------------------------------------ Boot
let eureka = null;
let server = null;

async function start() {
  await connect();
  const info = await serverInfo();
  console.log(`[db] connected to MongoDB ${info.version} (${info.atlas ? "Atlas" : "local"}), database ${info.database}`);
  await ensureSchema();
  if (config.seedOnStartup) await seedDatabase();

  // Atlas Search indexes are asynchronous and take ~1 min: they do not block the service start.
  ensureSearchIndexes().then((report) => report.forEach((r) => console.log(`[search] ${r.collection}/${r.name}: ${r.status}${r.reason ? " - " + r.reason : ""}`)));

  server = app.listen(config.port, () => {
    console.log(`[http] ${config.appName} listening at http://localhost:${config.port}${base}`);
    if (config.eureka.enabled) {
      eureka = startEureka({
        appName: config.appName,
        port: config.port,
        serviceUrl: config.eureka.serviceUrl,
        instanceIp: config.eureka.instanceIp,
        renewalIntervalSecs: config.eureka.renewalIntervalSecs,
        leaseDurationSecs: config.eureka.leaseDurationSecs,
        metadata: { database: `mongodb-${config.mongoDb}` },
      });
    } else {
      console.log("[eureka] disabled (EUREKA_ENABLED=false)");
    }
  });
}

async function shutdown(signal) {
  console.log(`\n[app] ${signal} received, shutting down...`);
  try {
    await eureka?.deregister();
    await new Promise((resolve) => (server ? server.close(resolve) : resolve()));
    await close();
  } finally {
    process.exit(0);
  }
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

start().catch((err) => {
  console.error("[app] failed to start:", err.message);
  if (/ENOTFOUND|ECONNREFUSED|Server selection timed out|authentication failed/i.test(err.message)) {
    console.error("[app] check MONGODB_URI in the .env file and whether this machine's IP is allowed in Atlas Network Access.");
  }
  process.exit(1);
});
