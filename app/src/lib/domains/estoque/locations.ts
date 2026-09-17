import type { SupabaseClient } from "@supabase/supabase-js";

// Hierarquia: organização → filial → depósito → localização.
// organization_id de warehouses/stock_locations é derivado por trigger
// no banco (não confiar em nenhum valor vindo do cliente pra esses
// dois campos — ver migration 00000000000004).

export type Branch = { id: string; code: string; name: string };
export type Warehouse = { id: string; branch_id: string; code: string; name: string };

export type StockLocation = {
  id: string;
  warehouse_id: string;
  name: string;
  rua: string | null;
  coluna: string | null;
  nivel: string | null;
  full_code: string | null;
  volume_util_m3: number | null;
  max_weight_kg: number | null;
  is_active: boolean;
};

export async function listBranches(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<Branch[]> {
  const { data, error } = (await supabase
    .from("branches")
    .select("id, code, name")
    .eq("organization_id", organizationId)
    .order("code")) as { data: Branch[] | null; error: unknown };
  if (error) throw error;
  return data ?? [];
}

export async function listWarehouses(
  supabase: SupabaseClient,
  branchId: string,
): Promise<Warehouse[]> {
  const { data, error } = (await supabase
    .from("warehouses")
    .select("id, branch_id, code, name")
    .eq("branch_id", branchId)
    .order("code")) as { data: Warehouse[] | null; error: unknown };
  if (error) throw error;
  return data ?? [];
}

export async function listLocations(
  supabase: SupabaseClient,
  warehouseId: string,
): Promise<StockLocation[]> {
  const { data, error } = (await supabase
    .from("stock_locations")
    .select("id, warehouse_id, name, rua, coluna, nivel, full_code, volume_util_m3, max_weight_kg, is_active")
    .eq("warehouse_id", warehouseId)
    .order("full_code")) as { data: StockLocation[] | null; error: unknown };
  if (error) throw error;
  return data ?? [];
}
