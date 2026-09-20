const { test } = require("node:test");
const assert = require("node:assert/strict");

test("extraction preserves valid results, escaping, and locale fallback", async () => {
  const before = (await import("../examples/catalog/before/render.mjs"))
    .renderSummary;
  const after = (await import("../examples/catalog/after/render.mjs"))
    .renderSummary;
  for (const items of [
    [],
    [{ name: "Pens", quantity: 0 }],
    [
      { name: '<tag> & "quotes"', quantity: 3 },
      { name: "Sam's", quantity: 2.5 },
    ],
  ]) {
    for (const locale of [
      undefined,
      "en",
      "fr",
      "fr-CA",
      "xx-YY",
      "constructor",
    ]) {
      assert.deepEqual(after(items, locale), before(items, locale));
    }
  }
  const result = after([{ name: "<script>", quantity: 2 }], "fr-CA");
  assert.equal(result.locale, "fr");
  assert.equal(result.total, 2);
  assert.match(result.body, /&lt;script&gt;/);
  assert.doesNotMatch(result.body, /<script>/);
});

test("invalid quantities now throw instead of reaching rendered output", async () => {
  const before = (await import("../examples/catalog/before/render.mjs"))
    .renderSummary;
  const after = (await import("../examples/catalog/after/render.mjs"))
    .renderSummary;
  for (const quantity of [-1, NaN, Infinity, -Infinity, "3"]) {
    assert.doesNotThrow(() => before([{ name: "Item", quantity }]));
    assert.throws(() => after([{ name: "Item", quantity }]), RangeError);
  }
});
