import { createClient } from "@/lib/supabase/server";
import {
  listMyMemberships,
  getOrganization,
  type Membership,
  type Organization,
} from "@/lib/domains/platform/organizations";

export type CurrentOrg = {
  organization: Organization;
  membership: Membership;
};

// Resolve a organização ativa do usuário logado. Hoje pega a primeira
// membership (na prática, cada usuário só tem uma). Quando existir
// uma segunda organização de verdade, é aqui que entra um seletor de
// organização (cookie/param + UI de troca) em vez de "primeira da lista".
export async function getCurrentOrg(): Promise<CurrentOrg | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const memberships = await listMyMemberships(supabase, user.id);
  const membership = memberships[0];
  if (!membership) return null;

  const organization = await getOrganization(
    supabase,
    membership.organization_id,
  );
  if (!organization) return null;

  return { organization, membership };
}
