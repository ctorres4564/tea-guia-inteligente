import { redirect } from "next/navigation";

import { ChatInterface } from "@/components/ChatInterface";
import { PageHeader } from "@/components/ui";
import { siteConfig } from "@/config/site";
import { getSessionUser } from "@/lib/security/session";

export const metadata = {
  title: "Assistente de IA — TEA Guia Inteligente",
  description: "Converse com o nosso assistente clínico de IA sobre autismo e neurodesenvolvimento.",
};

export default async function ChatPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    redirect(siteConfig.routes.login);
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
      <PageHeader
        title="Assistente de IA"
        description="Esclareça suas dúvidas com nosso orientador inteligente embasado na base clínica."
      />

      <ChatInterface />
    </div>
  );
}
