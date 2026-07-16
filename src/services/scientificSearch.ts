import { GoogleGenAI } from "@google/genai";

export interface ScientificArticle {
  title: string;
  authors: string;
  journal: string;
  year: string;
  url: string;
  abstractText: string;
}

/**
 * Busca por referências científicas atualizadas no Europe PMC (PubMed/Medline)
 * baseando-se na pergunta do usuário utilizando termos em inglês.
 */
export async function searchScientificReferences(
  query: string,
  apiKey: string
): Promise<ScientificArticle[]> {
  const backup: Record<string, string | undefined> = {
    GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    FIREBASE_ADMIN_PROJECT_ID: process.env.FIREBASE_ADMIN_PROJECT_ID,
    GCLOUD_PROJECT: process.env.GCLOUD_PROJECT,
    GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT,
  };

  // Delete all to force Gemini Developer API (AI Studio)
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  delete process.env.FIREBASE_ADMIN_PROJECT_ID;
  delete process.env.GCLOUD_PROJECT;
  delete process.env.GOOGLE_CLOUD_PROJECT;

  try {
    const ai = new GoogleGenAI({ apiKey });

    // 1. Converte a dúvida do usuário em termos de pesquisa em inglês usando Gemini
    const extractionPrompt = `Extraia termos de pesquisa acadêmicos em inglês para buscar no PubMed/Europe PMC com base nesta dúvida: "${query}". Retorne APENAS os termos de busca (ex: "echolalia autism intervention" ou "sensory processing autism"). Não inclua operadores booleanos complexos nem explicações.`;
    
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: extractionPrompt,
      config: {
        maxOutputTokens: 20,
        temperature: 0.1,
      },
    });

    const keywords = response.text?.trim().replace(/"/g, "") || "autism intervention children";
    
    // 2. Realiza a busca no webservice público do Europe PMC
    const searchUrl = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(
      keywords
    )}&format=json&pageSize=3`;

    const res = await fetch(searchUrl);
    if (!res.ok) {
      console.warn("[Scientific Search] Falha ao conectar ao Europe PMC API");
      return [];
    }

    const data = await res.json();
    const results = data.resultList?.result || [];

    return results.map((item: any) => {
      const title = item.title || "Sem título";
      const authors = item.authorString || "Autores não especificados";
      const journal = item.journalTitle || item.bookOrReportDetails?.publisher || "Periódico desconhecido";
      const year = item.pubYear || "N/A";
      const url = item.doi ? `https://doi.org/${item.doi}` : `https://europepmc.org/article/MED/${item.id}`;
      const abstractText = item.abstractText || "Resumo não disponível no repositório público.";

      return {
        title,
        authors,
        journal,
        year,
        url,
        abstractText,
      };
    });
  } catch (error) {
    console.error("[Scientific Search] Erro ao pesquisar artigos no Europe PMC:", error);
    return [];
  } finally {
    // Restore all
    Object.keys(backup).forEach((key) => {
      const val = backup[key];
      if (val !== undefined) {
        process.env[key] = val;
      }
    });
  }
}
