/**
 * Domínio `children` (perfil da criança — Fase 7).
 *
 * CRUD implementado em `src/domains/children/service.ts`. Usado para
 * personalizar o tom e os exemplos do assistente de IA (ver
 * `src/app/api/knowledge/chat/route.ts`) — nunca para fins diagnósticos.
 */
export type {
  ChildProfile,
  ChildProfileFormInput,
  DiagnosisStatus,
  SupportLevel,
  CommunicationStyle,
} from "@/lib/validation/child-profile.schema";
