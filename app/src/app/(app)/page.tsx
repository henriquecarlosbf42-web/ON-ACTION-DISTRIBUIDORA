import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/auth/current-org";

// Até os tipos reais do banco serem gerados (types/database.ts é um
// placeholder), o shape das linhas não é inferido — declarar aqui e
// checar em runtime é o suficiente pra essa etapa.
type ProfileRow = { full_name: string };

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = (await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user!.id)
    .maybeSingle()) as { data: ProfileRow | null };

  const currentOrg = await getCurrentOrg();

  return (
    <div className="max-w-2xl">
      <h1 className="text-lg font-semibold">Painel</h1>

      {!currentOrg && (
        <p className="mt-4 rounded-md bg-neutral-100 px-4 py-3 text-sm text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
          Login ok{profile ? ` como ${profile.full_name}` : ""}, mas esse
          usuário ainda não é membro de nenhuma organização
          (<code>organization_members</code>).
        </p>
      )}

      {currentOrg && (
        <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
          Logado como <strong>{profile?.full_name ?? user!.email}</strong> em{" "}
          <strong>{currentOrg.organization.name}</strong> (
          {currentOrg.membership.role}).
        </p>
      )}

      <p className="mt-8 text-sm text-neutral-400">
        Os módulos de catálogo, pedidos, estoque e CRM ainda não foram
        implementados — essa é só a fundação multi-tenant (auth + banco +
        isolamento por organização).
      </p>
    </div>
  );
}
