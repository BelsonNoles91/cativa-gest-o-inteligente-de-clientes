import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { test, expect } from "@playwright/test";
import { AUTH_SKIP_REASON, HAS_E2E_AUTH } from "../_helpers/auth";

type MembershipSnapshot = {
  id: string;
  role: string;
  status: string;
  invited_email: string | null;
  invited_at: string | null;
  accepted_at: string | null;
} | null;

function loadEnvFile(file: string) {
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

function env(key: string) {
  const value = process.env[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function tokenStorageKey(projectId: string, supabaseUrl: string) {
  if (projectId) return `sb-${projectId}-auth-token`;
  if (supabaseUrl) {
    try {
      const ref = new URL(supabaseUrl).hostname.split(".")[0];
      return `sb-${ref}-auth-token`;
    } catch {
      // fallback abaixo
    }
  }
  return "sb-project-auth-token";
}

function loadRequiredEnv() {
  loadEnvFile(resolve(process.cwd(), ".env.local"));
  loadEnvFile(resolve(process.cwd(), ".env"));

  const supabaseUrl = env("VITE_SUPABASE_URL");
  const publishableKey = env("VITE_SUPABASE_PUBLISHABLE_KEY");
  const projectId = env("VITE_SUPABASE_PROJECT_ID");
  const ownerEmail = env("E2E_USER");
  const ownerPassword = env("E2E_PASS");
  const inviteeEmail = env("E2E_FRONTDESK_USER");
  const inviteePassword = env("E2E_FRONTDESK_PASS");

  if (
    !supabaseUrl ||
    !publishableKey ||
    !ownerEmail ||
    !ownerPassword ||
    !inviteeEmail ||
    !inviteePassword
  ) {
    throw new Error(
      "VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, E2E_USER/E2E_PASS e E2E_FRONTDESK_USER/E2E_FRONTDESK_PASS são obrigatórios.",
    );
  }

  return {
    supabaseUrl,
    publishableKey,
    projectId,
    ownerEmail,
    ownerPassword,
    inviteeEmail,
    inviteePassword,
    storageKey: tokenStorageKey(projectId, supabaseUrl),
  };
}

function createSupabase(supabaseUrl: string, publishableKey: string) {
  return createClient(supabaseUrl, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function signIn(
  supabase: SupabaseClient,
  email: string,
  password: string,
) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data.user || !data.session) {
    throw new Error(`Login E2E não retornou sessão para ${email}.`);
  }
  return data;
}

async function findActiveTenant(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("tenant_memberships")
    .select("tenant_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .single();
  if (error) throw error;
  return data.tenant_id as string;
}

async function snapshotMembership(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
): Promise<MembershipSnapshot> {
  const { data, error } = await supabase
    .from("tenant_memberships")
    .select("id, role, status, invited_email, invited_at, accepted_at")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as MembershipSnapshot;
}

async function restoreMembership(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  snapshot: MembershipSnapshot,
) {
  if (snapshot) {
    await supabase
      .from("tenant_memberships")
      .update({
        role: snapshot.role,
        status: snapshot.status,
        invited_email: snapshot.invited_email,
        invited_at: snapshot.invited_at,
        accepted_at: snapshot.accepted_at,
      })
      .eq("id", snapshot.id);
    return;
  }

  await supabase
    .from("tenant_memberships")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("user_id", userId);
}

async function deletePendingInvites(
  supabase: SupabaseClient,
  tenantId: string,
  inviteeEmail: string,
) {
  await supabase
    .from("team_invitations")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("email", inviteeEmail.toLowerCase())
    .eq("status", "pending");
}

test.describe("team invitation", () => {
  test.describe.configure({ timeout: 120_000 });
  test.skip(!HAS_E2E_AUTH, AUTH_SKIP_REASON);

  test("cria convite e aceita pela tela /auth/aceite-convite", async ({ page }) => {
    const config = loadRequiredEnv();
    const ownerSupabase = createSupabase(config.supabaseUrl, config.publishableKey);
    const inviteeSupabase = createSupabase(config.supabaseUrl, config.publishableKey);
    let invitationId = "";
    let tenantId = "";
    let inviteeUserId = "";
    let originalMembership: MembershipSnapshot = null;

    try {
      const ownerAuth = await signIn(
        ownerSupabase,
        config.ownerEmail,
        config.ownerPassword,
      );
      const inviteeAuth = await signIn(
        inviteeSupabase,
        config.inviteeEmail,
        config.inviteePassword,
      );

      tenantId = await findActiveTenant(ownerSupabase, ownerAuth.user.id);
      inviteeUserId = inviteeAuth.user.id;
      originalMembership = await snapshotMembership(
        ownerSupabase,
        tenantId,
        inviteeUserId,
      );

      await deletePendingInvites(ownerSupabase, tenantId, config.inviteeEmail);

      const { data: inviteRows, error: inviteError } = await ownerSupabase.rpc(
        "create_team_invitation",
        {
          _tenant_id: tenantId,
          _email: config.inviteeEmail,
          _role: "frontdesk",
          _message: "Convite E2E assistido",
          _expires_in_days: 7,
        },
      );
      if (inviteError) throw inviteError;

      const invite = Array.isArray(inviteRows) ? inviteRows[0] : inviteRows;
      if (!invite?.id || !invite?.token) {
        throw new Error("RPC create_team_invitation não retornou id/token.");
      }
      invitationId = invite.id;

      await page.addInitScript(
        ({ storageKey, session }) => {
          window.localStorage.setItem(storageKey, JSON.stringify(session));
        },
        {
          storageKey: config.storageKey,
          session: {
            ...inviteeAuth.session,
            user: inviteeAuth.user,
            weak_password: null,
          },
        },
      );

      await page.goto(`/auth/aceite-convite?token=${invite.token}`, {
        waitUntil: "commit",
        timeout: 15_000,
      });
      await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => {});

      await expect(page.getByRole("heading", { name: "Convite de equipe" })).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.getByText(config.inviteeEmail, { exact: true })).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.getByText("Recepção", { exact: true })).toBeVisible({
        timeout: 30_000,
      });

      await page.getByRole("button", { name: "Aceitar convite" }).click();
      await expect(page.getByText("Convite aceito!", { exact: false })).toBeVisible({
        timeout: 30_000,
      });

      await expect
        .poll(
          async () => {
            const { data } = await ownerSupabase
              .from("team_invitations")
              .select("status, accepted_by")
              .eq("id", invitationId)
              .maybeSingle();
            return data ? `${data.status}:${data.accepted_by}` : "";
          },
          { timeout: 30_000 },
        )
        .toBe(`accepted:${inviteeUserId}`);

      await expect
        .poll(
          async () => {
            const { data } = await ownerSupabase
              .from("tenant_memberships")
              .select("role, status")
              .eq("tenant_id", tenantId)
              .eq("user_id", inviteeUserId)
              .maybeSingle();
            return data ? `${data.role}:${data.status}` : "";
          },
          { timeout: 30_000 },
        )
        .toBe("frontdesk:active");
    } finally {
      if (invitationId) {
        await ownerSupabase.from("team_invitations").delete().eq("id", invitationId);
      }
      if (tenantId && inviteeUserId) {
        await restoreMembership(
          ownerSupabase,
          tenantId,
          inviteeUserId,
          originalMembership,
        );
      }
      await ownerSupabase.auth.signOut();
      await inviteeSupabase.auth.signOut();
    }
  });
});
