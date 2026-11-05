import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RoboEduc IA Studio",
  description: "Laboratório educacional de inteligência artificial.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
