/**
 * Registro local de contatos de retorno/reativação.
 * Guarda no aparelho quem já foi contatado e com que resultado, para a
 * recepção não repetir a mesma pessoa no mesmo ciclo.
 */
export type OutreachOutcome = "sent" | "booked" | "no_answer" | "declined";

export interface OutreachLogEntry {
  clientId: string;
  outcome: OutreachOutcome;
  at: string;
}

const PREFIX = "cativa:outreach-log:";
/** Depois disso a pessoa volta a aparecer na lista. */
const TTL_DAYS = 30;

function key(tenantId: string) {
  return `${PREFIX}${tenantId}`;
}

export function readOutreachLog(tenantId: string): Record<string, OutreachLogEntry> {
  try {
    const raw = localStorage.getItem(key(tenantId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, OutreachLogEntry>;
    const cutoff = Date.now() - TTL_DAYS * 86_400_000;
    const fresh: Record<string, OutreachLogEntry> = {};
    for (const [id, entry] of Object.entries(parsed)) {
      if (new Date(entry.at).getTime() >= cutoff) fresh[id] = entry;
    }
    return fresh;
  } catch {
    return {};
  }
}

export function logOutreach(
  tenantId: string,
  clientId: string,
  outcome: OutreachOutcome,
): Record<string, OutreachLogEntry> {
  const current = readOutreachLog(tenantId);
  current[clientId] = { clientId, outcome, at: new Date().toISOString() };
  try {
    localStorage.setItem(key(tenantId), JSON.stringify(current));
  } catch {
    /* armazenamento cheio ou indisponível: seguimos sem registro local */
  }
  return current;
}

export function clearOutreachEntry(tenantId: string, clientId: string) {
  const current = readOutreachLog(tenantId);
  delete current[clientId];
  try {
    localStorage.setItem(key(tenantId), JSON.stringify(current));
  } catch {
    /* ignorado */
  }
  return current;
}

export const outcomeLabels: Record<OutreachOutcome, string> = {
  sent: "Mensagem enviada",
  booked: "Marcou horário",
  no_answer: "Sem resposta",
  declined: "Não quer agora",
};
