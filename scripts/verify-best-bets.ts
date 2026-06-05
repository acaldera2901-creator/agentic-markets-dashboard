import assert from "node:assert/strict";
import {
  buildBestBetRows,
  classifyFootballBestBet,
  classifyTennisBestBet,
} from "../lib/best-bets";

const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

const valueFootball = {
  kind: "football" as const,
  id: "fb-value",
  startsAt: future,
  label: "Alpha vs Beta",
  probability: 0.57,
  odds: 2.05,
  edge: 0.08,
};
const modelFootball = {
  kind: "football" as const,
  id: "fb-model",
  startsAt: future,
  label: "Gamma vs Delta",
  probability: 0.69,
  odds: null,
  edge: null,
};
const valueTennis = {
  kind: "tennis" as const,
  id: "tn-value",
  startsAt: future,
  label: "Player A vs Player B",
  probability: 0.63,
  odds: 1.9,
  edge: 0.04,
};

assert.equal(classifyFootballBestBet(valueFootball), "value");
assert.equal(classifyFootballBestBet(modelFootball), "model_signal");
assert.equal(classifyTennisBestBet(valueTennis), "value");

const rows = buildBestBetRows([modelFootball, valueFootball], [valueTennis], {
  sportFilter: "all",
  sortMode: "edge",
  query: "",
});

assert.equal(rows.mode, "value");
assert.deepEqual(rows.items.map((r) => r.id), ["fb-value", "tn-value"]);

const fallbackRows = buildBestBetRows([modelFootball], [], {
  sportFilter: "all",
  sortMode: "probability",
  query: "",
});
assert.equal(fallbackRows.mode, "model_signal");
assert.deepEqual(fallbackRows.items.map((r) => r.id), ["fb-model"]);

const emptyRows = buildBestBetRows([], [], {
  sportFilter: "all",
  sortMode: "probability",
  query: "",
});
assert.equal(emptyRows.mode, "empty");
assert.deepEqual(emptyRows.items, []);

console.log("best bets contract ok");
