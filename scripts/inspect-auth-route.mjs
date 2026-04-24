#!/usr/bin/env node
import { chromium } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(file) {
  if (!existsSync(file)) return;
  const content = readFileSync(file, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

async function waitForServer(url, timeoutMs = 60_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2_000);
    try {
      const response = await fetch(url, {
        method: "GET",
        signal: controller.signal,
      });
      if (response.ok) return;
    } catch {
      // noop
    } finally {
      clearTimeout(timer);
    }
    await new Promise((resolveSleep) => setTimeout(resolveSleep, 1000));
  }
  throw new Error(`Servidor não respondeu em ${url} após ${timeoutMs}ms`);
}

loadEnvFile(resolve(process.cwd(), ".env.local"));
loadEnvFile(resolve(process.cwd(), ".env"));

const route = process.argv[2] ?? "/app";
const baseUrl = process.env.E2E_BASE_URL ?? "http://127.0.0.1:8080";
const targetUrl = `${baseUrl}${route}`;
const storageStatePath = resolve(process.cwd(), "e2e/.auth/storageState.json");

if (!existsSync(storageStatePath)) {
  throw new Error(`storageState não encontrado em ${storageStatePath}`);
}

await waitForServer(`${baseUrl}/auth/login`);

const browser = await chromium.launch();
const context = await browser.newContext({ storageState: storageStatePath });
const page = await context.newPage();

try {
  console.log(`[inspect-auth-route] navegando para ${targetUrl}`);
  await page.goto(targetUrl, {
    waitUntil: "commit",
    timeout: 15_000,
  });
  await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(5_000);

  const bodyText = await page.locator("body").innerText().catch(() => "");
  const appMainCount = await page.locator("[data-app-main]").count();
  const loginHeadingCount = await page
    .getByRole("heading", { name: /bem-vindo de volta/i })
    .count();
  const onboardingStepCount = await page
    .getByText(/criar conta gratuita|nome e segmento|bem-vindo ao cativa/i)
    .count()
    .catch(() => 0);

  console.log(
    JSON.stringify(
      {
        route,
        currentUrl: page.url(),
        title: await page.title(),
        appMainCount,
        loginHeadingCount,
        onboardingStepCount,
        bodySnippet: bodyText.slice(0, 1500),
      },
      null,
      2,
    ),
  );
} finally {
  await context.close().catch(() => {});
  await browser.close().catch(() => {});
}

process.exit(0);
