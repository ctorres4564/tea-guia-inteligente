/**
 * Utilitários de cálculo de idade a partir de uma data de nascimento
 * (formato "AAAA-MM-DD"). Usados para exibir a idade atual do perfil da
 * criança e para personalizar o tom das respostas do assistente de IA.
 */

export interface AgeBreakdown {
  years: number;
  months: number;
  totalMonths: number;
}

export function calculateAge(birthDate: string, referenceDate: Date = new Date()): AgeBreakdown {
  // Parse diretamente da string para evitar ambiguidade de timezone.
  // new Date("YYYY-MM-DD") é UTC midnight; em fuso negativo (ex: UTC-3),
  // .getDate() retornaria o dia anterior. Usando getUTC* garantimos
  // consistência com o formato de entrada YYYY-MM-DD.
  // O formato é validado pelo schema Zod antes de chegar aqui.
  const parts = birthDate.split("-").map(Number);
  const birthYear = parts[0]!;
  const birthMonth = parts[1]!;
  const birthDay = parts[2]!;

  const refYear = referenceDate.getUTCFullYear();
  const refMonth = referenceDate.getUTCMonth() + 1; // 1-indexed
  const refDay = referenceDate.getUTCDate();

  let years = refYear - birthYear;
  let months = refMonth - birthMonth;

  if (refDay < birthDay) {
    months -= 1;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  years = Math.max(0, years);
  months = Math.max(0, months);

  return { years, months, totalMonths: years * 12 + months };
}

/**
 * Formata a idade em um texto curto e legível, em português.
 * Ex.: "4 anos e 3 meses", "8 meses", "1 ano".
 */
export function formatAgeLabel(birthDate: string, referenceDate: Date = new Date()): string {
  const { years, months } = calculateAge(birthDate, referenceDate);

  if (years === 0) {
    return months === 1 ? "1 mês" : `${months} meses`;
  }

  const yearsLabel = years === 1 ? "1 ano" : `${years} anos`;
  if (months === 0) return yearsLabel;

  const monthsLabel = months === 1 ? "1 mês" : `${months} meses`;
  return `${yearsLabel} e ${monthsLabel}`;
}
