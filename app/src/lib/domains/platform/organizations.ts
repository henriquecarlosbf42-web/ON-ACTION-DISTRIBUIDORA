import type { SupabaseClient } from "@supabase/supabase-js";

export type MemberRole = "admin" | "vendas" | "estoque" | "financeiro";

export type Membership = {
  organization_id: string;
  role: MemberRole;
};

export type Organization = {
  id: string;
  name: string;
};

// Tipagem manual até os tipos reais do banco serem gerados
// (ver src/types/database.ts).
export async function listMyMemberships(
  supabase: SupabaseClient,
  userId: string,
): Promise<Membership[]> {
  const { data } = (await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userId)) as { data: Membership[] | null };

  return data ?? [];
}

export async function getOrganization(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<Organization | null> {
  const { data } = (await supabase
    .from("organizations")
    .select("id, name")
    .eq("id", organizationId)
    .maybeSingle()) as { data: Organization | null };

  return data;
}
