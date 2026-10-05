import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
import { createEvidenceManifest } from "./e2e-evidence-manifest.mjs";

const execFile = promisify(execFileCallback);

test("aggregates JUnit counts and hashes files without embedding content or following secrets", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "cativa-evidence-manifest-"));
  const outsideDir = await mkdtemp(path.join(os.tmpdir(), "cativa-evidence-outside-"));
  try {
    const securityDir = path.join(rootDir, "e2e/.artifacts-security");
    const authDir = path.join(rootDir, "e2e/.artifacts-auth-contract");
    await mkdir(securityDir, { recursive: true });
    await mkdir(authDir, { recursive: true });
    const junitContent = '<testsuites tests="5" failures="1" errors="0" skipped="1"></testsuites>\n';
    const traceContent = "synthetic trace payload";
    await writeFile(path.join(securityDir, "junit.xml"), junitContent);
    await writeFile(path.join(authDir, "trace.zip"), traceContent);
    await writeFile(path.join(authDir, "storage-state.json"), '{"access_token":"never-copy-this"}');
    await writeFile(path.join(outsideDir, "outside.txt"), "outside");
    await symlink(path.join(outsideDir, "outside.txt"), path.join(authDir, "linked-secret.txt"));

    const result = await createEvidenceManifest({
      rootDir,
      inputDirs: ["e2e/.artifacts-security", "e2e/.artifacts-auth-contract"],
      outputPath: "e2e/.artifacts-auth-contract/evidence-manifest.json",
      env: { GITHUB_RUN_ID: "123456", GITHUB_SHA: "a".repeat(40), CI: "true", PRIVATE_TOKEN: "do-not-serialize" },
    });

    assert.deepEqual(result.manifest.testResults, {
      suites: 1, tests: 5, failures: 1, errors: 0, skipped: 1, passed: 3,
    });
    assert.equal(result.manifest.run.id, "123456");
    assert.equal(result.manifest.run.commitSha, "a".repeat(40));
    assert.equal(result.manifest.excludedFileCount, 2);
    assert.deepEqual(result.manifest.files.map(({ path: name }) => name), [
      "e2e/.artifacts-auth-contract/trace.zip",
      "e2e/.artifacts-security/junit.xml",
    ]);
    assert.equal(result.manifest.files[0].sha256, createHash("sha256").update(traceContent).digest("hex"));

    const serialized = await readFile(path.join(rootDir, result.manifestPath), "utf8");
    assert.equal(JSON.parse(serialized).files.length, 2);
    assert.equal(serialized.includes("never-copy-this"), false);
    assert.equal(serialized.includes("do-not-serialize"), false);
    assert.equal(serialized.includes("synthetic trace payload"), false);
    const expectedManifestHash = createHash("sha256").update(serialized).digest("hex");
    assert.equal(result.manifestSha256, expectedManifestHash);
    assert.equal(
      await readFile(path.join(rootDir, result.checksumPath), "utf8"),
      `${expectedManifestHash}  evidence-manifest.json\n`,
    );
  } finally {
    await rm(rootDir, { recursive: true, force: true });
    await rm(outsideDir, { recursive: true, force: true });
  }
});

test("rejects evidence paths outside the declared root", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "cativa-evidence-root-"));
  try {
    await assert.rejects(
      createEvidenceManifest({
        rootDir,
        inputDirs: ["../../etc"],
        outputPath: "manifest.json",
      }),
      /inside the evidence root/,
    );
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("CLI writes a manifest and a checksum sidecar for a disposable fixture", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "cativa-evidence-cli-"));
  try {
    await mkdir(path.join(rootDir, "results"), { recursive: true });
    await writeFile(path.join(rootDir, "results/junit.xml"), '<testsuites tests="2" failures="0" errors="0" skipped="0"></testsuites>');

    const scriptPath = fileURLToPath(new URL("./e2e-evidence-manifest.mjs", import.meta.url));
    const { stdout } = await execFile(process.execPath, [
      scriptPath,
      "--root", rootDir,
      "--input", "results",
      "--output", "evidence/out.json",
    ], { cwd: rootDir });
    const summary = JSON.parse(stdout);
    const serialized = await readFile(path.join(rootDir, summary.manifest), "utf8");
    const expectedHash = createHash("sha256").update(serialized).digest("hex");

    assert.equal(summary.tests.passed, 2);
    assert.equal(summary.files, 1);
    assert.equal(summary.sha256, expectedHash);
    assert.equal(
      await readFile(path.join(rootDir, summary.checksum), "utf8"),
      `${expectedHash}  out.json\n`,
    );
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
