// Validação da hierarquia de estoque (Etapa 4): unicidade de código,
// derivação segura de organization_id (o trigger tem que ignorar/
// corrigir um valor malicioso vindo do "cliente"), e isolamento entre
// organizações nas tabelas novas (branches/warehouses).
//
// Uso: node scripts/test-location-hierarchy.mjs

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

const admin = createClient(SUPABASE_URL, SERVICE_KEY);
const ids = { orgIds: [], userIds: [] };

async function fail(message, extra) {
  console.error(`FALHOU: ${message}`, extra ?? "");
  await cleanup();
  process.exit(1);
}

async function cleanup() {
  for (const userId of ids.userIds) {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
  }
  for (const orgId of ids.orgIds) {
    await admin.from("stock_locations").delete().eq("organization_id", orgId);
    await admin.from("warehouses").delete().eq("organization_id", orgId);
    await admin.from("branches").delete().eq("organization_id", orgId);
    await admin.from("organizations").delete().eq("id", orgId);
  }
}

async function setupOrgWithUser(label) {
  const email = `teste-hierarquia-${label}-${Date.now()}@example.com`;
  const password = "senha-de-teste-12345";
  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (userError) throw userError;
  ids.userIds.push(userData.user.id);

  const { data: org } = await admin.from("organizations").insert({ name: `Org hierarquia ${label}` }).select("id").single();
  ids.orgIds.push(org.id);

  await admin.from("profiles").insert({ id: userData.user.id, full_name: `Teste ${label}` });
  await admin.from("organization_members").insert({ organization_id: org.id, user_id: userData.user.id, role: "admin" });

  const client = createClient(SUPABASE_URL, ANON_KEY);
  await client.auth.signInWithPassword({ email, password });

  return { orgId: org.id, client };
}

const tenantA = await setupOrgWithUser("a");
const tenantB = await setupOrgWithUser("b");

// --- teste 1: código de filial único por organização ---
const { error: branchOk } = await tenantA.client
  .from("branches")
  .insert({ organization_id: tenantA.orgId, code: "M", name: "Matriz" });
if (branchOk) await fail("criar primeira filial deveria funcionar", branchOk);

const { error: branchDup } = await tenantA.client
  .from("branches")
  .insert({ organization_id: tenantA.orgId, code: "M", name: "Matriz duplicada" });
if (!branchDup) await fail("código de filial duplicado na mesma organização deveria falhar");

console.log("OK 1/4: unicidade de código de filial confirmada.");

// --- teste 2: mesmo código em organizações diferentes não conflita ---
const { error: branchBOk } = await tenantB.client
  .from("branches")
  .insert({ organization_id: tenantB.orgId, code: "M", name: "Matriz da org B" });
if (branchBOk) await fail("mesmo código 'M' em organização diferente não deveria colidir", branchBOk);

console.log("OK 2/4: códigos não colidem entre organizações diferentes.");

// --- teste 3: organization_id de warehouse é derivado, não confiável ---
const { data: branchA } = await admin.from("branches").select("id").eq("organization_id", tenantA.orgId).single();
const { data: fakeWarehouse, error: fakeError } = await tenantA.client
  .from("warehouses")
  .insert({ branch_id: branchA.id, code: "D1", name: "Depósito", organization_id: tenantB.orgId })
  .select("organization_id")
  .single();
if (fakeError) await fail("criar depósito válido não deveria falhar", fakeError);
if (fakeWarehouse.organization_id !== tenantA.orgId) {
  await fail(
    "trigger não corrigiu organization_id malicioso — depósito ficou associado à organização errada!",
    fakeWarehouse,
  );
}

console.log("OK 3/4: organization_id de warehouse é derivado do branch_id, ignora valor malicioso do cliente.");

// --- teste 4: isolamento — tenant B não vê filial/depósito do tenant A ---
const { data: crossBranch } = await tenantB.client.from("branches").select("id").eq("id", branchA.id).maybeSingle();
if (crossBranch) await fail("tenant B conseguiu ler filial do tenant A — vazamento!");

const { data: warehouseA } = await admin.from("warehouses").select("id").eq("organization_id", tenantA.orgId).limit(1).single();
const { data: crossWarehouse } = await tenantB.client.from("warehouses").select("id").eq("id", warehouseA.id).maybeSingle();
if (crossWarehouse) await fail("tenant B conseguiu ler depósito do tenant A — vazamento!");

console.log("OK 4/4: isolamento entre organizações confirmado em branches/warehouses.");
console.log("Hierarquia de estoque validada.");

await cleanup();
