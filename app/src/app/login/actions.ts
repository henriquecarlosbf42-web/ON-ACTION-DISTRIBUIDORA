"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error: string | null };

// Login roda no servidor (não no browser) de propósito: o cookie de
// sessão vai garantido junto da resposta HTTP, sem corrida entre
// "gravar cookie" e "navegar" — era isso que fazia o login falhar
// silenciosamente em conexões mais lentas (celular).
export async function signIn(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || typeof password !== "string") {
    return { error: "Preencha e-mail e senha." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  redirect("/");
}
