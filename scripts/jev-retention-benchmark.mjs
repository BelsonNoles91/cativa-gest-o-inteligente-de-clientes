#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { callJev, JevHttpError } from "../supabase/functions/_shared/jev.ts";
import {
  interpretRetentionResponse,
  RETENTION_QUESTIONS,
} from "../supabase/functions/retention-advisor/logic.ts";
import {
  buildRetentionBenchmarkReport,
  compareRetentionBenchmarkReports,
  retentionQuestionsForVariant,
  RETENTION_BENCHMARK_VERSION,
  validateRetentionBenchmarkCases,
} from "../supabase/functions/retention-advisor/benchmark.ts";
import { RETENTION_BENCHMARK_CASES } from "./jev-retention-benchmark-cases.ts";

const args = process.argv.slice(2);
const apiKey = process.env.TYPESAFE_API_KEY?.trim() ?? "";
const confirmedLive = args.includes("--confirm-live");
const repeats = numericOption("--repeats", 3);
const choiceOrderProbe = args.includes("--choice-order-probe");
const baselinePath = optionValue("--baseline");
const outputName = optionValue("--output-name");
const artifactDirectory = resolve("e2e/.artifacts-jev-retention");

if (!confirmedLive) {
  console.error(
    "Este benchmark envia fixtures sintéticas ao provedor e consome chamadas TypeSafe. " +
      "Para executá-lo intencionalmente, use --confirm-live.",
  );
  process.exit(2);
}
if (!apiKey) {
  console.error("TYPESAFE_API_KEY ausente; nenhum request foi enviado ao Jev.");
  process.exit(2);
}
if (!Number.isInteger(repeats) || repeats < 1 || repeats > 15) {
  console.error("--repeats deve ser um inteiro entre 1 e 15.");
  process.exit(2);
}
if (outputName && (!/^[a-zA-Z0-9._-]+\.json$/.test(outputName) || basename(outputName) !== outputName)) {
  console.error("--output-name deve ser apenas um nome de arquivo JSON, sem diretório.");
  process.exit(2);
}

try {
  validateRetentionBenchmarkCases(RETENTION_BENCHMARK_CASES);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Corpus Jev inválido; nenhum request foi enviado.");
  process.exit(2);
}

const variants = choiceOrderProbe
  ? ["production", "reversed-action-order"]
  : ["production"];
const plannedRequestCount = RETENTION_BENCHMARK_CASES.length * repeats * variants.length;
if (plannedRequestCount > 240) {
  console.error(`O plano excede o limite de segurança de 240 requests (${plannedRequestCount}).`);
  process.exit(2);
}

const corpusSha256 = sha256(JSON.stringify(RETENTION_BENCHMARK_CASES));
const questionsSha256 = sha256(JSON.stringify({
  production: RETENTION_QUESTIONS,
  variants: variants.map((variant) => [variant, retentionQuestionsForVariant(variant)]),
}));
let baseline;
if (baselinePath) {
  try {
    baseline = JSON.parse(await readFile(resolve(baselinePath), "utf8"));
  } catch {
    console.error("Não foi possível ler o baseline JSON solicitado; nenhum request foi enviado.");
    process.exit(2);
  }
  if (
    baseline?.schemaVersion !== 1 ||
    baseline?.benchmarkVersion !== RETENTION_BENCHMARK_VERSION ||
    baseline?.corpusSha256 !== corpusSha256 ||
    baseline?.questionsSha256 !== questionsSha256 ||
    baseline?.plannedReplicates !== repeats ||
    JSON.stringify(baseline?.variants) !== JSON.stringify(variants) ||
    baseline?.coverage?.complete !== true
  ) {
    console.error("O baseline não corresponde ao corpus, perguntas, variantes e repetições atuais; nenhum request foi enviado.");
    process.exit(2);
  }
}

const runId = randomUUID();
const startedAt = new Date().toISOString();
const observations = [];
let providerFailure;
let responseValidationFailure;
console.error(
  `Iniciando ${plannedRequestCount} request(s) sequenciais ao Jev; ` +
    `${RETENTION_BENCHMARK_CASES.length} casos sintéticos × ${repeats} repetição(ões) × ${variants.length} variante(s). ` +
    "Cada request terá no máximo uma tentativa.",
);

benchmark: for (let replicate = 1; replicate <= repeats; replicate += 1) {
  for (const benchmarkCase of RETENTION_BENCHMARK_CASES) {
    for (const variant of variants) {
      const started = performance.now();
      let response;
      try {
        response = await callJev({
          apiKey,
          request: {
            state: benchmarkCase.state,
            questions: retentionQuestionsForVariant(variant),
            model: "jev-latest",
          },
          maxAttempts: 1,
          timeoutMs: 15_000,
        });
      } catch (error) {
        providerFailure = {
          caseId: benchmarkCase.id,
          replicate,
          variant,
          status: error instanceof JevHttpError ? error.status : null,
          error: error instanceof Error ? error.message : "erro não classificado",
        };
        break benchmark;
      }
      try {
        interpretRetentionResponse(response, benchmarkCase.state);
      } catch (error) {
        responseValidationFailure = {
          caseId: benchmarkCase.id,
          replicate,
          variant,
          error: error instanceof Error ? error.message : "resposta Jev inválida",
        };
        break benchmark;
      }
      observations.push({
        caseId: benchmarkCase.id,
        replicate,
        variant,
        response,
        latencyMs: Math.round(performance.now() - started),
      });
      process.stderr.write(`Concluído ${observations.length}/${plannedRequestCount}: ${benchmarkCase.id} (${variant}).\n`);
    }
  }
}

const completedAt = new Date().toISOString();
const report = buildRetentionBenchmarkReport(RETENTION_BENCHMARK_CASES, observations, {
  runId,
  startedAt,
  completedAt,
  corpusSha256,
  questionsSha256,
  plannedReplicates: repeats,
  variants,
  ...(providerFailure ? { providerFailure } : {}),
  ...(responseValidationFailure ? { responseValidationFailure } : {}),
});
const drift = baseline && report.coverage.complete
  ? compareRetentionBenchmarkReports(report, baseline)
  : undefined;
const filename = outputName ?? `retention-${startedAt.replace(/[:.]/g, "-")}-${runId.slice(0, 8)}.json`;
const outputPath = resolve(artifactDirectory, filename);
await mkdir(artifactDirectory, { recursive: true });
await writeFile(outputPath, `${JSON.stringify({ ...report, ...(drift ? { drift } : {}) }, null, 2)}\n`, {
  encoding: "utf8",
  flag: "wx",
  mode: 0o600,
});

const passed =
  report.coverage.complete &&
  report.safety.passed &&
  !providerFailure &&
  !responseValidationFailure;
console.log(JSON.stringify({
  status: passed ? "complete" : "incomplete-or-safety-failed",
  report: outputPath,
  requests: report.usage.requests,
  plannedRequests: plannedRequestCount,
  models: report.modelVersions,
  metrics: report.metrics,
  stability: report.stability,
  choiceOrderProbe: report.choiceOrderProbe,
  safety: report.safety,
  qualityThresholds: report.qualityThresholds,
  ...(responseValidationFailure ? { responseValidationFailure } : {}),
  ...(drift ? { drift: {
    status: drift.status,
    pairedObservations: drift.pairedObservations,
    modelVersionChanged: drift.modelVersionChanged,
    actionFlipRate: drift.actionFlipRate,
    meanActionProbabilityTotalVariation: drift.meanActionProbabilityTotalVariation,
  } } : {}),
  ...(providerFailure ? { providerFailure } : {}),
}, null, 2));
if (!passed) process.exitCode = 1;

function optionValue(name) {
  const prefix = `${name}=`;
  return args.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

function numericOption(name, fallback) {
  const value = optionValue(name);
  return value === undefined ? fallback : Number(value);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
