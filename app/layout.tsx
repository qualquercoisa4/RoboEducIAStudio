import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RoboEduc Game Creator",
  description: "Crie ideias de jogos e transforme-as em prompts com inteligência artificial.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
