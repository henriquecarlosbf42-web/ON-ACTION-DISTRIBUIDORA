// Validação do núcleo de estoque (Etapa 3): concorrência, idempotência
// e efetivação. Cria organização + usuário + produto + saldo reais no
// Supabase, testa as regras críticas e limpa tudo no final.
//
// Uso: node scripts/test-stock-core.mjs

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
const ids = {};

async function fail(message, extra) {
  console.error(`FALHOU: ${message}`, extra ?? "");
  await cleanup();
  process.exit(1);
}

async function cleanup() {
  if (ids.userId) await admin.auth.admin.deleteUser(ids.userId).catch(() => {});
  if (ids.orgId) {
    await admin.from("audit_log").delete().eq("organization_id", ids.orgId);
    await admin.from("stock_movements").delete().eq("organization_id", ids.orgId);
    await admin.from("stock_reservations").delete().eq("organization_id", ids.orgId);
    await admin.from("orders").delete().eq("organization_id", ids.orgId);
    await admin.from("customers").delete().eq("organization_id", ids.orgId);
    await admin.from("inventory_levels").delete().eq("organization_id", ids.orgId);
    await admin.from("stock_locations").delete().eq("organization_id", ids.orgId);
    await admin.from("product_variants").delete().eq("organization_id", ids.orgId);
    await admin.from("products").delete().eq("organization_id", ids.orgId);
    await admin.from("organizations").delete().eq("id", ids.orgId);
  }
}

// --- setup ---
const email = `teste-estoque-${Date.now()}@example.com`;
const password = "senha-de-teste-12345";

const { data: userData, error: userError } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
if (userError) await fail("criar usuário de teste", userError);
ids.userId = userData.user.id;

const { data: org } = await admin.from("organizations").insert({ name: "Org teste estoque" }).select("id").single();
ids.orgId = org.id;

await admin.from("profiles").insert({ id: ids.userId, full_name: "Teste Estoque" });
await admin.from("organization_members").insert({ organization_id: ids.orgId, user_id: ids.userId, role: "admin" });

let { data: unit } = await admin.from("units").select("id").eq("code", "UN").maybeSingle();
if (!unit) {
  const inserted = await admin.from("units").insert({ code: "UN", description: "Unidade" }).select("id").single();
  unit = inserted.data;
}
ids.unitId = unit.id;

const { data: product } = await admin
  .from("products")
  .insert({ organization_id: ids.orgId, name: "Produto teste" })
  .select("id")
  .single();

const { data: variant } = await admin
  .from("product_variants")
  .insert({ organization_id: ids.orgId, product_id: product.id, sku: `SKU-TEST-${Date.now()}`, unit_id: ids.unitId })
  .select("id")
  .single();

const { data: location } = await admin
  .from("stock_locations")
  .insert({ organization_id: ids.orgId, name: "Depósito teste" })
  .select("id")
  .single();

await admin.from("inventory_levels").insert({
  organization_id: ids.orgId,
  product_variant_id: variant.id,
  location_id: location.id,
  quantity_on_hand: 10,
});

const { data: customer } = await admin
  .from("customers")
  .insert({ organization_id: ids.orgId, type: "b2c", name: "Cliente teste" })
  .select("id")
  .single();

const { data: channel } = await admin.from("sales_channels").select("id").eq("code", "manual").single();

const { data: order, error: orderError } = await admin
  .from("orders")
  .insert({ organization_id: ids.orgId, customer_id: customer.id, channel_id: channel.id })
  .select("id")
  .single();
if (orderError) await fail("criar pedido de teste", orderError);

const client = createClient(SUPABASE_URL, ANON_KEY);
await client.auth.signInWithPassword({ email, password });

// --- teste 1: idempotência ---
const key1 = `teste-${Date.now()}-a`;
const { data: r1, error: e1 } = await client.rpc("reserve_stock", {
  p_organization_id: ids.orgId,
  p_order_id: order.id,
  p_product_variant_id: variant.id,
  p_location_id: location.id,
  p_quantity: 3,
  p_idempotency_key: key1,
});
if (e1) await fail("primeira reserva falhou", e1);

const { data: r1b, error: e1b } = await client.rpc("reserve_stock", {
  p_organization_id: ids.orgId,
  p_order_id: order.id,
  p_product_variant_id: variant.id,
  p_location_id: location.id,
  p_quantity: 3,
  p_idempotency_key: key1,
});
if (e1b) await fail("segunda chamada com mesma idempotency_key deu erro", e1b);
if (r1b.id !== r1.id) await fail("idempotência falhou: criou uma reserva nova em vez de devolver a existente");

console.log("OK 1/3: idempotência confirmada (mesma chave = mesma reserva).");

// --- teste 2: concorrência (saldo restante = 7; duas reservas de 5 ao mesmo tempo) ---
const [c1, c2] = await Promise.all([
  client.rpc("reserve_stock", {
    p_organization_id: ids.orgId,
    p_order_id: order.id,
    p_product_variant_id: variant.id,
    p_location_id: location.id,
    p_quantity: 5,
    p_idempotency_key: `teste-${Date.now()}-b1`,
  }),
  client.rpc("reserve_stock", {
    p_organization_id: ids.orgId,
    p_order_id: order.id,
    p_product_variant_id: variant.id,
    p_location_id: location.id,
    p_quantity: 5,
    p_idempotency_key: `teste-${Date.now()}-b2`,
  }),
]);

const successes = [c1, c2].filter((r) => !r.error).length;
const failures = [c1, c2].filter((r) => r.error).length;
if (successes !== 1 || failures !== 1) {
  await fail(
    `concorrência falhou: esperava 1 sucesso e 1 falha (saldo só permite uma das duas), veio ${successes} sucesso(s) e ${failures} falha(s)`,
    { c1: c1.error?.message, c2: c2.error?.message },
  );
}
console.log("OK 2/3: concorrência confirmada (só uma das duas reservas simultâneas passou).");

// --- teste 3: efetivação baixa o físico ---
const fulfillKey = `teste-${Date.now()}-fulfill`;
const { data: movement, error: fulfillError } = await client.rpc("fulfill_reservation", {
  p_reservation_id: r1.id,
  p_idempotency_key: fulfillKey,
});
if (fulfillError) await fail("efetivar reserva falhou", fulfillError);

const { data: level } = await admin
  .from("inventory_levels")
  .select("quantity_on_hand")
  .eq("product_variant_id", variant.id)
  .eq("location_id", location.id)
  .single();

// 10 - 3 (efetivada) = 7 (a outra reserva de 5 continua só reservada, não baixada)
if (Number(level.quantity_on_hand) !== 7) {
  await fail(`efetivação não baixou o físico corretamente: esperava 7, veio ${level.quantity_on_hand}`);
}
if (!movement || movement.quantity !== 3) {
  await fail("movimentação gerada pela efetivação não bate com a quantidade da reserva");
}

console.log("OK 3/3: efetivação confirmada (físico baixado corretamente, movimentação registrada).");
console.log("Núcleo de estoque validado.");

await cleanup();
