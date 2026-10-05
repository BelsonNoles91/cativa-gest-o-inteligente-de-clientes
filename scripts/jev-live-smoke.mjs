#!/usr/bin/env node
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { callJev, JevHttpError } from "../supabase/functions/_shared/jev.ts";
import {
  RETENTION_QUESTIONS,
  interpretRetentionResponse,
} from "../supabase/functions/retention-advisor/logic.ts";

const apiKey = process.env.TYPESAFE_API_KEY?.trim() ?? "";
if (!apiKey) {
  console.error("TYPESAFE_API_KEY ausente; o smoke real do provedor foi interrompido.");
  process.exit(2);
}

// Fixture inteiramente sintética: sem nome, telefone, e-mail ou identificador.
const state = {
  evaluatedAt: new Date().toISOString(),
  client: {
    isVip: false,
    riskLevel: "medium",
    needsReactivation: true,
    daysSinceLastVisit: 44,
    daysUntilNextVisit: null,
    averageCycleDays: 30,
    churnRiskScore: 58,
    contactAvailable: true,
  },
  appointments: {
    completedLastYear: 4,
    noShowsLastYear: 0,
    cancellationsLastYear: 1,
    futureBooked: 0,
    futureUnconfirmed: 0,
  },
  packages: {
    activeWithRemainingSessions: 1,
    remainingSessions: 3,
    expiringWithin30Days: 1,
  },
  contacts: {
    attemptsLast60Days: 0,
    successfulLast60Days: 0,
  },
};

const startedAt = performance.now();
let providerResponse;
try {
  // Uma única chamada HTTP: o live smoke não repete requisições nem consome
  // orçamento adicional após timeout/429/5xx.
  providerResponse = await callJev({
    apiKey,
    request: {
      state,
      questions: RETENTION_QUESTIONS,
      model: "jev-latest",
    },
    maxAttempts: 1,
    timeoutMs: 15_000,
  });
  const advice = interpretRetentionResponse(providerResponse, state);

  assert.ok(providerResponse.model.trim(), "o provedor deve identificar o modelo usado");
  assert.ok(Number.isSafeInteger(providerResponse.usage.input_tokens));
  assert.ok(Number.isSafeInteger(providerResponse.usage.output_tokens));
  assert.equal(advice.automaticAction, false, "Jev jamais executa ações automaticamente");
  assert.ok(advice.confidence >= 0 && advice.confidence <= 1);
  assert.ok(advice.evidenceSufficiency >= 0 && advice.evidenceSufficiency <= 1);
  assert.ok(["none", "low", "moderate", "high", "uncertain"].includes(advice.urgencyLevel));

  console.log(JSON.stringify({
    status: "passed",
    model: providerResponse.model,
    action: advice.action,
    recommendationStatus: advice.status,
    confidence: advice.confidence,
    evidenceSufficiency: advice.evidenceSufficiency,
    urgencyLevel: advice.urgencyLevel,
    automaticAction: advice.automaticAction,
    usage: providerResponse.usage,
    latencyMs: Math.round(performance.now() - startedAt),
    fixture: "synthetic/no-PII",
  }));
} catch (error) {
  const status = error instanceof JevHttpError ? error.status : null;
  const urgencyAnswer = providerResponse?.answers?.urgency;
  const urgencyRecord = urgencyAnswer && typeof urgencyAnswer === "object" && !Array.isArray(urgencyAnswer)
    ? urgencyAnswer
    : null;
  const urgencyDiagnostic = urgencyAnswer && typeof urgencyAnswer === "object" && !Array.isArray(urgencyAnswer)
    ? {
        type: urgencyRecord.type,
        score: urgencyRecord.score,
        probabilities: urgencyRecord.probabilities,
        legend: urgencyRecord.legend,
        confidence: urgencyRecord.confidence,
      }
    : null;
  console.error(JSON.stringify({
    status: "failed",
    providerStatus: status,
    error: error instanceof Error ? error.message : "erro não classificado",
    responseModel: providerResponse?.model ?? null,
    urgencyDiagnostic,
    usage: providerResponse?.usage ?? null,
    latencyMs: Math.round(performance.now() - startedAt),
    fixture: "synthetic/no-PII",
  }));
  process.exitCode = 1;
}
