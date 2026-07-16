import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  getAuthorizedSession,
  CONTENT_EDITOR_ROLES,
  REVIEWER_ROLES,
} from "@/lib/security/authorization";
import { mapFirebaseError } from "@/lib/errors/firebase-errors";
import { z } from "zod";

/**
 * Route Handler para edição segura de conteúdos clínicos.
 *
 * Usa o Admin SDK para contornar as regras do Firestore e gravar
 * campos protegidos (embeddingVersion) no servidor, garantindo que:
 *
 * 1. embeddingVersion: 0 é gravado ao editar — invalida o vetor semântico
 *    desatualizado até a próxima publicação.
 * 2. Se o item estava 'published' ou 'approved', o status é revertido
 *    para 'in_review', obrigando nova aprovação antes de republicar.
 * 3. Professional só pode editar itens em 'draft' ou 'in_review'.
 *    Reviewer/admin podem editar qualquer status (com reversão automática).
 */

const patchSchema = z.object({
  id: z.string().min(1, "ID obrigatório."),
  patch: z.object({
    categoryId: z.string().optional(),
    title: z.string().optional(),
    slug: z.string().optional(),
    summary: z.string().optional(),
    content: z.string().optional(),
    targetAudience: z.array(z.string()).optional(),
    ageRange: z.string().optional(),
    tags: z.array(z.string()).optional(),
    evidenceLevel: z.string().optional(),
  }),
});

export async function PATCH(request: NextRequest) {
  try {
    // 1. Valida sessão: qualquer editor de conteúdo com conta ativa
    const authSession = await getAuthorizedSession(CONTENT_EDITOR_ROLES);
    if (!authSession) {
      return NextResponse.json(
        { error: "Acesso negado. É necessário ser editor de conteúdo com conta ativa." },
        { status: 403 }
      );
    }

    const { profile } = authSession;
    const isReviewer = REVIEWER_ROLES.includes(profile.role);

    // 2. Valida e extrai payload
    const body = await request.json();
    const parseResult = patchSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Payload inválido.", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { id, patch } = parseResult.data;

    // 3. Lê o item atual via Admin SDK
    const db = getAdminFirestore();
    const docRef = db.collection("knowledgeItems").doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json(
        { error: "Item de conhecimento não encontrado." },
        { status: 404 }
      );
    }

    const data = docSnap.data()!;

    // 4. Garante que item não está excluído
    if (data.deletedAt) {
      return NextResponse.json(
        { error: "Não é possível editar um item excluído." },
        { status: 400 }
      );
    }

    // 5. Professional só pode editar draft e in_review.
    //    Reviewer/admin podem editar qualquer status (itens publicados serão revertidos).
    const currentStatus: string = data.reviewStatus ?? "draft";
    const editableByProfessional = ["draft", "in_review"].includes(currentStatus);

    if (!isReviewer && !editableByProfessional) {
      return NextResponse.json(
        {
          error: `Acesso negado. Profissionais só podem editar rascunhos e itens em revisão. Este item está com status "${currentStatus}".`,
        },
        { status: 403 }
      );
    }

    // 6. Se publicado ou aprovado, reverte para in_review — obriga nova aprovação.
    //    Garante que nenhum conteúdo clínico publicado seja alterado silenciosamente.
    const shouldRevertStatus = ["published", "approved"].includes(currentStatus);

    const updatePayload: Record<string, unknown> = {
      ...patch,
      version: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
      // Invalida o vetor semântico: a próxima publicação via /api/admin/knowledge/publish
      // regenerará o embedding e gravará embeddingVersion: 1.
      embeddingVersion: 0,
    };

    if (shouldRevertStatus) {
      updatePayload.reviewStatus = "in_review";
    }

    await docRef.update(updatePayload);

    return NextResponse.json({
      success: true,
      reviewStatusChanged: shouldRevertStatus,
      newReviewStatus: shouldRevertStatus ? "in_review" : currentStatus,
    });
  } catch (error) {
    console.error("Erro no Route Handler de edição de conteúdo:", error);
    const mappedError = mapFirebaseError(error);
    return NextResponse.json(
      { error: mappedError.message || "Erro interno ao processar a edição." },
      { status: 500 }
    );
  }
}
