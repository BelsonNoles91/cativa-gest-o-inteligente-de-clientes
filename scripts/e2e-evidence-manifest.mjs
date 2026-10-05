import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, mkdir, readdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SENSITIVE_NAME = /^(?:\.env(?:\..*)?|.*(?:service[-_]?role|storage[-_]?state|auth[-_]?state).*)$|\.(?:pem|p12|pfx|key|keystore)$/i;

function resolveWithinRoot(rootDir, inputPath, label) {
  const root = path.resolve(rootDir);
  const absolute = path.resolve(root, inputPath);
  const relative = path.relative(root, absolute);
  if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`${label} must be a child path inside the evidence root`);
  }
  return absolute;
}

async function rejectSymlinkComponents(root, absolute) {
  let cursor = root;
  const components = path.relative(root, absolute).split(path.sep).filter(Boolean);
  for (const component of components) {
    cursor = path.join(cursor, component);
    try {
      if ((await lstat(cursor)).isSymbolicLink()) {
        throw new Error(`Evidence paths cannot traverse symlinks: ${path.relative(root, cursor)}`);
      }
    } catch (error) {
      if (error?.code === "ENOENT") return;
      throw error;
    }
  }
}

function junitCounts(xml) {
  const rootTag = xml.match(/<testsuites\b[^>]*>/)?.[0];
  const tags = rootTag && /\btests="\d+"/.test(rootTag)
    ? [rootTag]
    : [...xml.matchAll(/<testsuite\b[^>]*>/g)].map(([tag]) => tag);
  return tags.reduce((total, tag) => {
    const read = (name) => Number(tag.match(new RegExp(`\\b${name}="(\\d+)"`))?.[1] ?? 0);
    total.tests += read("tests");
    total.failures += read("failures");
    total.errors += read("errors");
    total.skipped += read("skipped");
    total.suites += 1;
    return total;
  }, { suites: 0, tests: 0, failures: 0, errors: 0, skipped: 0 });
}

async function sha256File(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

async function collectFiles(directory, relativeDirectory, files, outputPath, checksumPath, excluded, junitSummary) {
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);

  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    const relative = path.posix.join(relativeDirectory, entry.name);
    if (absolute === outputPath || absolute === checksumPath) continue;
    if (SENSITIVE_NAME.test(entry.name)) {
      excluded.count += 1;
      continue;
    }
    if (entry.isSymbolicLink()) {
      excluded.count += 1;
      continue;
    }
    if (entry.isDirectory()) {
      await collectFiles(absolute, relative, files, outputPath, checksumPath, excluded, junitSummary);
      continue;
    }
    if (!entry.isFile()) continue;

    const info = await stat(absolute);
    const sha256 = await sha256File(absolute);
    files.push({ path: relative, sizeBytes: info.size, sha256 });
    if (relative.endsWith(".xml") && /(?:^|\/)junit[^/]*\.xml$/i.test(relative)) {
      const counts = junitCounts(await readFile(absolute, "utf8"));
      for (const key of Object.keys(counts)) junitSummary[key] += counts[key];
    }
  }
}

export async function createEvidenceManifest({ rootDir = process.cwd(), inputDirs, outputPath, env = process.env }) {
  if (!Array.isArray(inputDirs) || inputDirs.length === 0) {
    throw new Error("At least one --input directory is required");
  }
  if (!outputPath) throw new Error("An --output manifest path is required");

  const root = await realpath(path.resolve(rootDir));
  const inputs = inputDirs.map((input) => resolveWithinRoot(root, input, "Input directory"));
  const output = resolveWithinRoot(root, outputPath, "Output manifest");
  const outputParent = path.dirname(output);
  await rejectSymlinkComponents(root, outputParent);
  const checksum = `${output}.sha256`;
  const files = [];
  const missingInputs = [];
  const excluded = { count: 0 };
  const junitSummary = { suites: 0, tests: 0, failures: 0, errors: 0, skipped: 0 };

  for (let index = 0; index < inputs.length; index += 1) {
    const input = inputs[index];
    const relativeInput = path.relative(root, input).split(path.sep).join("/");
    await rejectSymlinkComponents(root, input);
    let info;
    try {
      info = await lstat(input);
    } catch (error) {
      if (error?.code === "ENOENT") {
        missingInputs.push(relativeInput);
        continue;
      }
      throw error;
    }
    if (!info.isDirectory() || info.isSymbolicLink() || await realpath(input) !== input) {
      throw new Error(`Input must be a real directory: ${relativeInput}`);
    }
    await collectFiles(input, relativeInput, files, output, checksum, excluded, junitSummary);
  }

  files.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  const runId = /^\d{1,32}$/.test(env.GITHUB_RUN_ID ?? "")
    ? env.GITHUB_RUN_ID
    : `local-${randomUUID()}`;
  const commitSha = /^[a-f0-9]{40}$/i.test(env.GITHUB_SHA ?? "") ? env.GITHUB_SHA : null;
  const manifest = {
    formatVersion: 1,
    generatedAt: new Date().toISOString(),
    run: { id: runId, commitSha, ci: env.CI === "true" },
    runtime: { node: process.version, platform: process.platform, architecture: process.arch },
    inputs: inputs.map((input) => path.relative(root, input).split(path.sep).join("/")),
    missingInputs,
    excludedFileCount: excluded.count,
    testResults: {
      ...junitSummary,
      passed: Math.max(0, junitSummary.tests - junitSummary.failures - junitSummary.errors - junitSummary.skipped),
    },
    files,
  };

  const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
  const manifestHash = createHash("sha256").update(serialized).digest("hex");
  const outputInfo = await lstat(output).catch((error) => error?.code === "ENOENT" ? null : Promise.reject(error));
  const checksumInfo = await lstat(checksum).catch((error) => error?.code === "ENOENT" ? null : Promise.reject(error));
  if (outputInfo || checksumInfo) throw new Error("Evidence output already exists; choose a new output path");

  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, serialized, { flag: "wx" });
  await writeFile(checksum, `${manifestHash}  ${path.basename(output)}\n`, { flag: "wx" });

  return {
    manifest,
    manifestPath: path.relative(root, output).split(path.sep).join("/"),
    checksumPath: path.relative(root, checksum).split(path.sep).join("/"),
    manifestSha256: manifestHash,
  };
}

function parseArgs(argv) {
  const inputDirs = [];
  let outputPath = null;
  let rootDir = null;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--input" && argv[index + 1]) inputDirs.push(argv[++index]);
    else if (argument === "--output" && argv[index + 1]) outputPath = argv[++index];
    else if (argument === "--root" && argv[index + 1]) rootDir = argv[++index];
    else if (argument === "--help") return { help: true, inputDirs, outputPath };
    else throw new Error(`Unknown or incomplete argument: ${argument}`);
  }
  return { inputDirs, outputPath, rootDir, help: false };
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      process.stdout.write("Usage: node scripts/e2e-evidence-manifest.mjs [--root <dir>] --input <dir> [--input <dir> ...] --output <manifest.json>\n");
      return;
    }
    const result = await createEvidenceManifest({ ...args, rootDir: args.rootDir ?? process.cwd() });
    process.stdout.write(`${JSON.stringify({
      manifest: result.manifestPath,
      checksum: result.checksumPath,
      sha256: result.manifestSha256,
      files: result.manifest.files.length,
      tests: result.manifest.testResults,
      missingInputs: result.manifest.missingInputs,
    }, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`Evidence manifest failed: ${error instanceof Error ? error.message : "unknown error"}\n`);
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) await main();
