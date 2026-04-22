#!/usr/bin/env node
/**
 * Gera /mnt/documents/access-matrix.md a partir do snapshot escrito pelo
 * teste `src/test/access-matrix.test.ts` em /tmp/access-matrix.json.
 *
 * Uso:
 *   bunx vitest run src/test/access-matrix.test.ts && node scripts/generate-access-evidence.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const IN = "/tmp/access-matrix.json";
const OUT = "/mnt/documents/access-matrix.md";

const data = JSON.parse(readFileSync(IN, "utf-8"));

const ROLES = ["owner", "manager", "frontdesk", "professional"];
const REASON_LABEL = {
  none: "—",
  role: "Papel sem permissão",
  feature: "Feature do plano não inclui",
  role_and_feature: "Papel + feature bloqueiam",
};

const lines = [];
lines.push("# Cativa — Matriz de Acesso (QA mobile-aware)");
lines.push("");
lines.push(`> Gerado em ${new Date(data.generatedAt).toLocaleString("pt-BR")} a partir de \`src/test/access-matrix.test.ts\`.`);
lines.push("");
lines.push("Esta matriz reflete EXATAMENTE a regra aplicada por `AppSidebar` e `BottomNav` no app:");
lines.push("");
lines.push("```ts");
lines.push("visible = canAccess(role, item.roles) && (!item.featureKey || hasFeature(item.featureKey))");
lines.push("```");
lines.push("");
lines.push("O banner **Sem assinatura** aparece quando `!subscription` para o tenant atual (ver `AppSidebar.tsx`).");
lines.push("");

// Sumário
lines.push("## Sumário");
lines.push("");
lines.push("| Tenant | Plano | Status | Banner s/ assinatura | Features ativas |");
lines.push("|---|---|---|:-:|---|");
for (const t of data.tenants) {
  lines.push(
    `| ${t.name} | ${t.plan} | \`${t.status}\` | ${t.showsNoSubscriptionBanner ? "✅" : "—"} | ${t.enabledFeatures.length ? t.enabledFeatures.map((f) => `\`${f}\``).join(", ") : "_nenhuma_"} |`,
  );
}
lines.push("");

// Por tenant
for (const t of data.tenants) {
  lines.push(`## ${t.name}`);
  lines.push("");
  lines.push(`- **Plano:** ${t.plan}`);
  lines.push(`- **Status:** \`${t.status}\``);
  lines.push(`- **Banner "Sem assinatura":** ${t.showsNoSubscriptionBanner ? "**APARECE** para todos os papéis" : "não aparece"}`);
  lines.push("");
  lines.push("### Itens visíveis por papel");
  lines.push("");
  lines.push("| Item | " + ROLES.join(" | ") + " |");
  lines.push("|---|" + ROLES.map(() => ":-:").join("|") + "|");

  const allLabels = new Set();
  for (const r of ROLES) {
    for (const lab of t.perRole[r].visibleItems) allLabels.add(lab);
    for (const b of t.perRole[r].blockedItems) allLabels.add(b.label);
  }
  for (const label of allLabels) {
    const row = [label];
    for (const r of ROLES) {
      const visible = t.perRole[r].visibleItems.includes(label);
      const blocked = t.perRole[r].blockedItems.find((b) => b.label === label);
      if (visible) row.push("✅");
      else if (blocked) row.push(blocked.reason === "feature" ? "🔒" : "⛔");
      else row.push("—");
    }
    lines.push("| " + row.join(" | ") + " |");
  }
  lines.push("");
  lines.push("Legenda: ✅ visível · 🔒 bloqueado por **feature do plano** · ⛔ bloqueado por **papel**");
  lines.push("");

  // Detalhe por papel
  lines.push("### Detalhe por papel");
  lines.push("");
  for (const r of ROLES) {
    const info = t.perRole[r];
    lines.push(`<details><summary><strong>${r}</strong> — ${info.totalVisible} visíveis · ${info.totalBlocked} bloqueados</summary>`);
    lines.push("");
    if (info.visibleItems.length) {
      lines.push(`- ✅ Visíveis: ${info.visibleItems.map((l) => `\`${l}\``).join(", ")}`);
    }
    if (info.blockedItems.length) {
      lines.push(`- 🚫 Bloqueados:`);
      for (const b of info.blockedItems) {
        lines.push(`  - \`${b.label}\` — ${REASON_LABEL[b.reason]}${b.featureKey ? ` (\`${b.featureKey}\`)` : ""}`);
      }
    }
    lines.push("");
    lines.push("</details>");
    lines.push("");
  }
}

// Notas mobile
lines.push("## Notas — comportamento mobile");
lines.push("");
lines.push("- O **BottomNav** (mobile) usa o mesmo filtro do `AppSidebar`, restrito aos itens com `showInBottomNav: true`.");
lines.push("- Para **professional**, isso normalmente reduz o BottomNav a `Painel` + `Agenda` (Clientes e Confirmações ficam ocultos).");
lines.push("- No tenant **sem assinatura**, o `NoSubscriptionBanner` aparece tanto no rodapé do sidebar quanto, no mobile, acima do conteúdo. A CTA \"Ativar trial\" só dispara para `owner`/`manager`.");
lines.push("- Itens com `featureKey` (\\`confirmation_center\\`, \\`packages_memberships\\`, \\`analytics\\`) somem por completo do menu quando o plano não inclui a feature — não aparecem como \"em breve\" para evitar ruído visual em telas pequenas.");
lines.push("");

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, lines.join("\n"));
console.log(`✓ Relatório gravado em ${OUT}`);
