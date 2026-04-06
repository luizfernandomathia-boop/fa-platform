import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "FA Solutions — Análise Financeira e Contábil",
  description:
    "Plataforma B2B de análise financeira e contábil: DRE, Balanço Patrimonial, Fluxo de Caixa e SPED.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
