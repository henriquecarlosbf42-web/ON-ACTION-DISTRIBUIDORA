import type { SupabaseClient } from "@supabase/supabase-js";

// Núcleo de estoque. Nenhuma escrita direta em inventory_levels,
// stock_reservations ou stock_movements — sempre via RPC (a função
// no banco garante concorrência, idempotência e auditoria juntas).
// Ver supabase/migrations/00000000000003_stock_core.sql.

export type ReservationStatus = "active" | "released" | "fulfilled";

export type StockReservation = {
  id: string;
  organization_id: string;
  order_id: string;
  product_variant_id: string;
  location_id: string;
  quantity: number;
  status: ReservationStatus;
  idempotency_key: string | null;
  created_at: string;
};

export type StockMovement = {
  id: string;
  organization_id: string;
  product_variant_id: string;
  location_id: string;
  type: "entrada" | "saida" | "ajuste";
  quantity: number;
  reference: string | null;
  reservation_id: string | null;
  idempotency_key: string | null;
  created_at: string;
};

export type StockAvailability = {
  organization_id: string;
  product_variant_id: string;
  location_id: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  quantity_available: number;
};

export async function reserveStock(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    orderId: string;
    productVariantId: string;
    locationId: string;
    quantity: number;
    idempotencyKey: string;
  },
): Promise<StockReservation> {
  const { data, error } = await supabase.rpc("reserve_stock", {
    p_organization_id: params.organizationId,
    p_order_id: params.orderId,
    p_product_variant_id: params.productVariantId,
    p_location_id: params.locationId,
    p_quantity: params.quantity,
    p_idempotency_key: params.idempotencyKey,
  });
  if (error) throw error;
  return data as StockReservation;
}

export async function releaseReservation(
  supabase: SupabaseClient,
  reservationId: string,
): Promise<StockReservation> {
  const { data, error } = await supabase.rpc("release_reservation", {
    p_reservation_id: reservationId,
  });
  if (error) throw error;
  return data as StockReservation;
}

export async function fulfillReservation(
  supabase: SupabaseClient,
  params: { reservationId: string; idempotencyKey: string },
): Promise<StockMovement> {
  const { data, error } = await supabase.rpc("fulfill_reservation", {
    p_reservation_id: params.reservationId,
    p_idempotency_key: params.idempotencyKey,
  });
  if (error) throw error;
  return data as StockMovement;
}

export async function getAvailability(
  supabase: SupabaseClient,
  params: { productVariantId: string; locationId: string },
): Promise<StockAvailability | null> {
  const { data, error } = (await supabase
    .from("stock_availability")
    .select("*")
    .eq("product_variant_id", params.productVariantId)
    .eq("location_id", params.locationId)
    .maybeSingle()) as { data: StockAvailability | null; error: unknown };
  if (error) throw error;
  return data;
}
