// Placeholder até o projeto Supabase real ser criado e linkado.
// Depois de `supabase link`, gerar os tipos de verdade com:
//   supabase gen types typescript --linked > src/types/database.ts
//
// A forma abaixo só existe pra satisfazer o generic do supabase-js
// (permite `.from("qualquer_tabela")` sem checagem de coluna até os
// tipos reais serem gerados). `any` é intencional aqui — some assim
// que os tipos forem gerados de verdade.
/* eslint-disable @typescript-eslint/no-explicit-any */
export type Database = {
  public: {
    Tables: Record<string, { Row: any; Insert: any; Update: any }>;
    Views: Record<string, { Row: any }>;
    Functions: Record<string, { Args: any; Returns: any }>;
    Enums: Record<string, string>;
    CompositeTypes: Record<string, any>;
  };
};

