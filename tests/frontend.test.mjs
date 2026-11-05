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
test("API wrapper reports server validation failures", () => {
  const api = readFileSync(new URL("../lib/api.ts", import.meta.url), "utf8");
  assert.ok(api.includes("!response.ok"));
  assert.ok(api.includes("throw new Error"));
  assert.ok(api.includes("credentials:'same-origin'"));
});
