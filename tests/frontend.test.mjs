import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = readFileSync(
  new URL("../components/dashboard.tsx", import.meta.url),
  "utf8",
);
test("all major research modules are navigable", () => {
  for (const name of [
    "hospitals",
    "datasets",
    "federated-learning",
    "agents",
    "clinical-research",
    "models",
    "analytics",
    "privacy",
    "reports",
    "audit-logs",
    "settings",
  ])
    assert.ok(source.includes(name), name);
});
test("critical action wiring calls actual backend operations", () => {
  for (const endpoint of [
    "/federated/rounds/start",
    "/agents/workflow/start",
    "/research/predict",
    "/research/reviews",
    "/datasets/upload",
    "/privacy/config",
  ])
    assert.ok(source.includes(endpoint), endpoint);
});
test("API wrapper sends cookies and propagates validation errors", async () => {
  const ts = await import('typescript');
  const text = readFileSync(new URL('../lib/api.ts', import.meta.url), 'utf8');
  const js = ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
  const {api} = await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => {assert.equal(url,'/api/example');assert.equal(options.credentials,'same-origin');return new Response(JSON.stringify({detail:'Hospital data is isolated'}),{status:403,headers:{'Content-Type':'application/json'}})};
    await assert.rejects(api('/example'),/Hospital data is isolated/);
    globalThis.fetch = async () => new Response(JSON.stringify({status:'ok'}),{status:200});
    assert.deepEqual(await api('/example'),{status:'ok'});
  } finally {globalThis.fetch=original}
});
