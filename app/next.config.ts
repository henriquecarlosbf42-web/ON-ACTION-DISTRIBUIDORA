import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite acessar o dev server pelo IP da rede local (ex: testar
  // pelo celular) sem o Next bloquear os recursos de desenvolvimento
  // (HMR etc.) por serem de uma origem diferente de localhost.
  allowedDevOrigins: ["172.16.177.147"],
};

export default nextConfig;
