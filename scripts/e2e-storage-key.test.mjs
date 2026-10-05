import assert from "node:assert/strict";
import test from "node:test";
import { supabaseAuthStorageKey } from "./e2e-storage-key.mjs";

test("usa o ref do host Supabase para projetos hospedados", () => {
  assert.equal(
    supabaseAuthStorageKey("https://uqskxftzmjsumykpkwus.supabase.co"),
    "sb-uqskxftzmjsumykpkwus-auth-token",
  );
});

test("espelha a chave do cliente Supabase em loopback IPv4", () => {
  assert.equal(
    supabaseAuthStorageKey("http://127.0.0.1:56201"),
    "sb-127-auth-token",
  );
});

test("espelha a chave do cliente Supabase em domínio local nomeado", () => {
  assert.equal(
    supabaseAuthStorageKey("http://cativa.localhost:56201"),
    "sb-cativa-auth-token",
  );
});

test("rejeita uma URL malformada em vez de criar storage state inconsistente", () => {
  assert.throws(() => supabaseAuthStorageKey("não-é-url"), TypeError);
});
