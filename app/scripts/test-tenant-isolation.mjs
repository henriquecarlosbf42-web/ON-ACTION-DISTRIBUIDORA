// Validação de isolamento multi-tenant (Etapa 2).
// Cria 2 organizações + 2 usuários de teste, cada um com um cliente
// próprio, e confirma que um usuário não enxerga dado da organização
// do outro. Limpa tudo no final, mesmo se um assert falhar.
//
// Uso: node scripts/test-tenant-isolation.mjs
// Requer .env.local preenchido (URL + service role key).

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

function loadEnvLocal() {
  const content = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of content.split("\n")) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match) process.env[match[1]] = match[2].trim();
  }
}

loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  console.error("Faltam variáveis em .env.local");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

const cleanup = { userIds: [], orgIds: [] };

async function fail(message) {
  console.error(`FALHOU: ${message}`);
  await cleanupAll();
  process.exit(1);
}

async function cleanupAll() {
  for (const userId of cleanup.userIds) {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
  }
  // customers não tem ON DELETE CASCADE de organizations (de propósito
  // — apagar uma organização não deve apagar dado de negócio sem
  // querer), então precisa ser limpo antes ou a delete da org falha.
  for (const orgId of cleanup.orgIds) {
    await admin.from("customers").delete().eq("organization_id", orgId);
    await admin.from("organizations").delete().eq("id", orgId);
  }
}

async function setupTenant(label) {
  const email = `teste-isolamento-${label}-${Date.now()}@example.com`;
  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email,
    password: "senha-de-teste-12345",
    email_confirm: true,
  });
  if (userError) throw userError;
  cleanup.userIds.push(userData.user.id);

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({ name: `Org teste ${label}` })
    .select("id")
    .single();
  if (orgError) throw orgError;
  cleanup.orgIds.push(org.id);

  await admin.from("profiles").insert({ id: userData.user.id, full_name: `Teste ${label}` });
  await admin
    .from("organization_members")
    .insert({ organization_id: org.id, user_id: userData.user.id, role: "admin" });

  const { data: customer, error: customerError } = await admin
    .from("customers")
    .insert({
      organization_id: org.id,
      type: "b2c",
      name: `Cliente sigiloso da org ${label}`,
    })
    .select("id")
    .single();
  if (customerError) throw customerError;

  const client = createClient(SUPABASE_URL, ANON_KEY);
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password: "senha-de-teste-12345",
  });
  if (signInError) throw signInError;

  return { orgId: org.id, customerId: customer.id, client };
}

const tenantA = await setupTenant("a");
const tenantB = await setupTenant("b");

// 1. Cada usuário vê o próprio cliente.
const { data: ownData, error: ownError } = await tenantA.client
  .from("customers")
  .select("id")
  .eq("id", tenantA.customerId)
  .maybeSingle();
if (ownError || !ownData) {
  await fail("usuário A não conseguiu ler o próprio dado (RLS bloqueou demais)");
}

// 2. Usuário A não vê o cliente da organização B.
const { data: crossData } = await tenantA.client
  .from("customers")
  .select("id")
  .eq("id", tenantB.customerId)
  .maybeSingle();
if (crossData) {
  await fail("usuário A conseguiu ler dado da organização B — vazamento de tenant!");
}

// 3. Usuário B não vê organização A na lista de organizations.
const { data: crossOrg } = await tenantB.client
  .from("organizations")
  .select("id")
  .eq("id", tenantA.orgId)
  .maybeSingle();
if (crossOrg) {
  await fail("usuário B conseguiu ler a organização A — vazamento de tenant!");
}

console.log("OK: isolamento entre organizações confirmado (3/3 checagens).");
await cleanupAll();
