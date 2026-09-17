import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/auth/current-org";
import { SignOutButton } from "@/components/sign-out-button";

const MODULES = [
  { href: "/", label: "Painel", available: true },
  { href: "/catalogo", label: "Catálogo", available: false },
  { href: "/pedidos", label: "Pedidos", available: false },
  { href: "/estoque", label: "Estoque", available: false },
  { href: "/crm", label: "CRM", available: false },
] as const;

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const currentOrg = await getCurrentOrg();

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 border-r border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="px-4 py-5">
          <p className="text-sm font-semibold tracking-tight">
            {currentOrg?.organization.name ?? "Sem organização"}
          </p>
        </div>
        <nav className="flex flex-col gap-1 px-2">
          {MODULES.map((mod) =>
            mod.available ? (
              <Link
                key={mod.href}
                href={mod.href}
                className="rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-200/60 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                {mod.label}
              </Link>
            ) : (
              <span
                key={mod.href}
                className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-neutral-400 dark:text-neutral-600"
              >
                {mod.label}
                <span className="text-xs">em breve</span>
              </span>
            ),
          )}
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-3 dark:border-neutral-800">
          <span className="text-sm text-neutral-500">{user.email}</span>
          <SignOutButton />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
