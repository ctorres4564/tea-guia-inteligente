/**
 * Utilitário de Segurança: Rate Limiting em Memória.
 *
 * Implementa janela deslizante simples por chave (ex: IP do cliente ou UID do usuário).
 * Permite configurar limites flexíveis para diferentes endpoints.
 */

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
}

const memoryStore = new Map<string, { count: number; windowStart: number }>();

// Limpeza periódica em segundo plano a cada 5 minutos para evitar vazamento de memória
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of memoryStore.entries()) {
      if (now - value.windowStart > 15 * 60 * 1000) { // Janelas com mais de 15 min de inatividade
        memoryStore.delete(key);
      }
    }
  }, 5 * 60 * 1000).unref?.(); // .unref() evita que o timer segure o processo do Node ativo no encerramento
}

export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const entry = memoryStore.get(key);

  const resetTime = (entry ? entry.windowStart : now) + config.windowMs;

  // Se não houver registro ou a janela expirou, reinicia
  if (!entry || now - entry.windowStart > config.windowMs) {
    memoryStore.set(key, { count: 1, windowStart: now });
    return {
      success: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - 1,
      resetTime: now + config.windowMs,
    };
  }

  // Se excedeu o limite
  if (entry.count >= config.maxRequests) {
    return {
      success: false,
      limit: config.maxRequests,
      remaining: 0,
      resetTime,
    };
  }

  // Incrementa contador
  entry.count++;
  return {
    success: true,
    limit: config.maxRequests,
    remaining: config.maxRequests - entry.count,
    resetTime,
  };
}
