import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "RoboEduc IA Studio",
  description: "Assistente de IA educacional da RoboEduc para programação, robótica e criação de projetos.",
};

export default function IAStudioLayout({ children }: { children: React.ReactNode }) {
  return children;
}
