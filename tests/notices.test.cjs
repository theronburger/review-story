const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const root = path.join(__dirname, "../examples/notices/source");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const modules = Promise.all(
  ["catalog", "select", "validate", "contracts", "run"].map(
    (name) => import(`../examples/notices/source/${name}.mjs`),
  ),
);

test("notice selection expands an English edit, isolates a translation, and audits shared changes", async () => {
  const [{ catalog }, { selectAffected }] = await modules;
  assert.deepEqual(
    selectAffected(["templates/en/shipment.json"], catalog).map(
      (e) => e.locale,
    ),
    ["en", "fr", "de"],
  );
  assert.deepEqual(
    selectAffected(["templates/fr/shipment.json"], catalog).map(
      (e) => e.locale,
    ),
    ["fr"],
  );
  assert.equal(selectAffected(["shared.mjs"], catalog).length, 6);
  assert.equal(selectAffected([], catalog, true).length, 6);
  assert.equal(selectAffected(["README.md"], catalog).length, 0);
});

test("notice validator accepts derived and shared inputs and equivalent token sets", async () => {
  const [, , { validate }, { loadContract }] = await modules;
  const allowed = loadContract("shipment", read);
  const source = read("templates/en/shipment.json");
  const candidate = JSON.parse(read("templates/fr/shipment.json"));
  candidate.body += " {{recipient}}";
  assert.deepEqual(validate(source, JSON.stringify(candidate), allowed), []);
});

test("notice validator rejects missing widgets, moved fields, unknown inputs and malformed placeholders", async () => {
  const [, , { validate }, { loadContract }] = await modules;
  const allowed = loadContract("shipment", read);
  const source = read("templates/en/shipment.json");
  const candidate = JSON.parse(read("templates/fr/shipment.json"));
  candidate.body = candidate.body.replace("{{itemTable}}", "");
  candidate.preview += "{{itemTable}}";
  let issues = validate(source, JSON.stringify(candidate), allowed);
  assert(
    issues.some((i) => i.field === "body" && i.missing?.includes("itemTable")),
  );
  assert(
    issues.some(
      (i) => i.field === "preview" && i.unexpected?.includes("itemTable"),
    ),
  );
  delete candidate.subject;
  candidate.body += "{{secretCode}}";
  issues = validate(source, JSON.stringify(candidate), allowed);
  assert(
    issues.some((i) => i.kind === "field-presence" && i.field === "subject"),
  );
  assert(
    issues.some((i) => i.kind === "unknown-input" && i.name === "secretCode"),
  );
  for (const broken of [
    "{",
    "null",
    '{"body":""}',
    '{"body":"{{broken.name}}"}',
  ]) {
    assert.equal(validate(broken, source, allowed)[0].side, "source");
    assert.equal(validate(source, broken, allowed)[0].side, "translation");
  }
});

test("notice runner collects failures, keeps checking, and returns a failing exit code", async () => {
  const [{ catalog }, , , , { run }] = await modules;
  assert.equal(run({ changed: [], catalog, read, all: true }).exitCode, 0);
  const report = run({
    changed: [],
    catalog,
    all: true,
    read: (file) => (file === "templates/fr/shipment.json" ? "{" : read(file)),
  });
  assert.equal(report.checked, 6);
  assert.equal(report.exitCode, 1);
  assert.equal(report.results.filter((r) => r.issues.length).length, 1);
});

test("documented P2 reproduces: contract-only edit skips all five dependents", () => {
  const result = JSON.parse(
    execFileSync(process.execPath, [path.join(root, "reproduce.mjs")], {
      encoding: "utf8",
    }),
  );
  assert.equal(result.scoped.checked, 0);
  assert.equal(result.full.checked, 6);
  assert.equal(result.full.exitCode, 1);
});
