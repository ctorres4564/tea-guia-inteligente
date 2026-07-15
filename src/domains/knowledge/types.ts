/**
 * Domínio `knowledge` (base de conhecimento clínica).
 *
 * CRUD administrativo, upload de materiais e fluxo de revisão implementados
 * na Fase 2 (ver `src/domains/knowledge/service.ts` e `storage-service.ts`).
 * Busca semântica, embeddings e RAG permanecem para fases futuras (ver ROADMAP.md).
 */
export type {
  KnowledgeItem,
  KnowledgeSource,
  KnowledgeAttachment,
  EvidenceLevel,
  ReviewStatus,
  TargetAudience,
  SourceType,
} from "@/lib/validation/knowledge.schema";
