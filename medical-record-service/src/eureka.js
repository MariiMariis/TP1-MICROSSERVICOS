// Minimal Eureka client written on top of the Netflix Eureka REST API.
//
// The Node service does exactly what spring-cloud-starter-netflix-eureka-client does in the
// Java services: registers the instance, sends a heartbeat every 5s and removes itself on
// shutdown. That way the api-gateway keeps resolving lb://medical-record-service without
// knowing (or needing to know) that this service is no longer Java.
//
// Reference: https://github.com/Netflix/eureka/wiki/Eureka-REST-operations
import os from "node:os";

function detectIp() {
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    if (/virtual|vethernet|vmware|wsl|docker/i.test(name)) continue;
    for (const a of addrs) if (a.family === "IPv4" && !a.internal) return a.address;
  }
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs) if (a.family === "IPv4" && !a.internal) return a.address;
  }
  return "127.0.0.1";
}

export function startEureka({ appName, port, serviceUrl, instanceIp, renewalIntervalSecs, leaseDurationSecs, metadata = {} }) {
  const app = appName.toUpperCase();
  const ip = instanceIp || detectIp();
  const instanceId = `${ip}:${appName}:${port}`;
  const base = `http://${ip}:${port}`;
  const appsUrl = `${serviceUrl}/apps/${app}`;
  const instanceUrl = `${appsUrl}/${encodeURIComponent(instanceId)}`;

  const body = {
    instance: {
      instanceId,
      hostName: ip,
      app,
      ipAddr: ip,
      vipAddress: appName,
      secureVipAddress: appName,
      status: "UP",
      port: { $: port, "@enabled": "true" },
      securePort: { $: 443, "@enabled": "false" },
      homePageUrl: `${base}/`,
      statusPageUrl: `${base}/actuator/info`,
      healthCheckUrl: `${base}/actuator/health`,
      dataCenterInfo: { "@class": "com.netflix.appinfo.InstanceInfo$DefaultDataCenterInfo", name: "MyOwn" },
      leaseInfo: { renewalIntervalInSecs: renewalIntervalSecs, durationInSecs: leaseDurationSecs },
      metadata: { runtime: `node ${process.version}`, ...metadata },
    },
  };

  const state = { registered: false, instanceId, ip, timer: null, stopped: false };

  async function register() {
    const res = await fetch(appsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(4000),
    });
    if (res.status !== 204 && res.status !== 200) throw new Error(`Eureka answered ${res.status}`);
    state.registered = true;
    console.log(`[eureka] registered as ${app} (${instanceId}) at ${serviceUrl}`);
  }

  async function heartbeat() {
    if (state.stopped) return;
    try {
      if (!state.registered) {
        await register();
        return;
      }
      const res = await fetch(`${instanceUrl}?status=UP`, { method: "PUT", signal: AbortSignal.timeout(4000) });
      if (res.status === 404) {
        // Eureka restarted or the lease expired: register again.
        state.registered = false;
        await register();
      } else if (!res.ok) {
        throw new Error(`heartbeat answered ${res.status}`);
      }
    } catch (err) {
      if (state.registered) console.warn(`[eureka] heartbeat failed: ${err.message}`);
      else console.warn(`[eureka] discovery-server unavailable at ${serviceUrl} (${err.message}); retrying...`);
      state.registered = false;
    }
  }

  async function deregister() {
    state.stopped = true;
    clearInterval(state.timer);
    if (!state.registered) return;
    try {
      await fetch(instanceUrl, { method: "DELETE", signal: AbortSignal.timeout(3000) });
      console.log("[eureka] instance removed from the registry");
    } catch (err) {
      console.warn(`[eureka] failed to deregister: ${err.message}`);
    }
  }

  heartbeat();
  state.timer = setInterval(heartbeat, renewalIntervalSecs * 1000);
  state.timer.unref();

  return { deregister, state };
}
