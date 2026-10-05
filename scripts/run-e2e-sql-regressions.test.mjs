import test from "node:test";
import assert from "node:assert/strict";
import { renderJUnitXml, SQL_REGRESSIONS } from "./run-e2e-sql-regressions.mjs";

test("JUnit reporter escapes XML metacharacters and preserves outcomes", () => {
  const xml = renderJUnitXml({
    generatedAt: "2026-10-03T12:00:00Z",
    targetMode: "local <QA> & disposable",
    cases: [
      { classname: "supabase.sql", name: "RLS & IDOR", timeMs: 1250 },
      {
        classname: "supabase.sql",
        name: "tenant <scope>",
        timeMs: 750,
        failure: { type: "SQLRegressionFailure", message: "status 1 & retry <needed>" },
      },
    ],
    pending: ["not run"],
  });

  assert.match(xml, /tests="3" failures="1" errors="0" skipped="1" time="2\.000"/);
  assert.match(xml, /target_mode" value="local &lt;QA&gt; &amp; disposable"/);
  assert.match(xml, /name="RLS &amp; IDOR"/);
  assert.match(xml, /name="tenant &lt;scope&gt;"/);
  assert.match(xml, /message="status 1 &amp; retry &lt;needed&gt;"/);
  assert.match(xml, /<skipped message="not executed because an earlier stage did not complete"\/>/);
});

test("JUnit reporter marks all unstarted SQL regressions as skipped", () => {
  const xml = renderJUnitXml({
    generatedAt: "2026-10-03T12:00:00Z",
    cases: [{ classname: "supabase.preflight", name: "QA target guard", timeMs: 1, error: { type: "QAGuard", message: "guard exited with status 2" } }],
    pending: SQL_REGRESSIONS.map(([name]) => name),
  });

  assert.match(xml, new RegExp(`tests="${SQL_REGRESSIONS.length + 1}" failures="0" errors="1" skipped="${SQL_REGRESSIONS.length}"`));
  assert.ok(xml.includes('<error type="QAGuard" message="guard exited with status 2"/>'));
});
