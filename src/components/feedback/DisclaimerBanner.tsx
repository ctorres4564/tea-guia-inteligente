import { Alert } from "@/components/ui";
import { siteConfig } from "@/config/site";

/**
 * Aviso obrigatório de finalidade educacional (ver PRD e instruções do projeto).
 * Deve aparecer na página inicial e no rodapé; futuramente também nas respostas do sistema.
 */
export function DisclaimerBanner() {
  return (
    <Alert variant="warning" role="note">
      {siteConfig.disclaimer}
    </Alert>
  );
}
