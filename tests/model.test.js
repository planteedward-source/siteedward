import test from "node:test";
import assert from "node:assert/strict";
import {
  activeSeason,
  initialData,
  totalFor,
  count,
  validateFile,
} from "../src/model.js";

test("public totals reflect Edward’s confirmed season statistics", () => {
  for (const team of ["trident", "jm"]) {
    const totals = totalFor(initialData, activeSeason(initialData).id, team);
    assert.deepEqual([totals.matches, totals.goals, totals.assists], team === "trident" ? [2, 0, 2] : [0, 0, 0]);
  }
});
test("home and statistics resolve the same published team and active season", () => {
  const data = structuredClone(initialData);
  data.seasons.push({ id: "2027-2028", label: "2027-2028", active: true });
  data.seasons[0].active = false;
  data.totals.push({
    season_id: "2027-2028",
    team: "trident",
    goals: 5,
    assists: 3,
    matches: 4,
  });
  assert.equal(totalFor(data, activeSeason(data).id, "trident").goals, 5);
  assert.equal(totalFor(data, "2027-2028", "trident").assists, 3);
  assert.equal(totalFor(data, "2027-2028", "jm").goals, 0);
  assert.equal(totalFor(data, "2026-2027", "trident").goals, 0);
});
test("counters refuse negative, fractional, missing and excessive values", () => {
  for (const value of [-1, 0.5, "", NaN, Infinity, 10001])
    assert.throws(() => count(value));
  for (const value of [0, "15", 10000])
    assert.equal(count(value), Number(value));
});
test("uploads reject active formats, oversized media and video hero photos", () => {
  assert.throws(() => validateFile({ type: "image/svg+xml", size: 100 }));
  assert.throws(() =>
    validateFile({ type: "image/png", size: 9 * 1024 * 1024 }),
  );
  assert.throws(() => validateFile({ type: "video/mp4", size: 100 }, true));
  assert.throws(() => validateFile({ type: "image/jpeg", size: 0 }));
  assert.doesNotThrow(() => validateFile({ type: "video/webm", size: 100 }));
  assert.doesNotThrow(() =>
    validateFile({ type: "image/png", size: 100 }, true),
  );
});
