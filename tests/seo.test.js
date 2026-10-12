import test from "node:test";
import assert from "node:assert/strict";
import {
  seoPages,
  robotsFor,
  structuredData,
  safeJson,
  siteUrl,
} from "../src/seo.js";
test("public metadata is unique and identifies the same real player", () => {
  assert.equal(new Set(Object.values(seoPages).map((p) => p.title)).size, 5);
  for (const path of Object.keys(seoPages)) {
    assert.ok(seoPages[path].description.length > 80);
    assert.match(robotsFor(path), /^index/);
    const person = structuredData(path)["@graph"].find(
      (n) => n["@type"] === "Person",
    );
    assert.equal(person["@id"], `${siteUrl}/#edward-plante`);
    assert.equal(person.name, "Edward Plante");
    assert.equal(person.birthDate, undefined);
    assert.equal(person.telephone, undefined);
    assert.deepEqual(
      person.memberOf.map((t) => t.name),
      ["CS Trident", "JM Bleu & Or"],
    );
  }
});
test("private and missing pages are noindex without profile schema", () => {
  for (const path of ["/admin", "/introuvable"]) {
    assert.equal(robotsFor(path), "noindex, nofollow");
    assert.equal(structuredData(path), null);
  }
});
test("serialized public data cannot escape its HTML script element", () => {
  const value = { title: "</script><script>alert(1)</script>" };
  const encoded = safeJson(value);
  assert.ok(!encoded.includes("<"));
  assert.deepEqual(JSON.parse(encoded), value);
});
