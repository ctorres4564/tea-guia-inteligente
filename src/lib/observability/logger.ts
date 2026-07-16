/**
 * Utilitário de Observabilidade: Logger Estruturado.
 *
 * Em produção (process.env.NODE_ENV === "production"), gera logs em formato
 * JSON estruturado de linha única (ideal para APMs e Cloud Logging).
 * Em desenvolvimento local, imprime de forma humanizada e legível.
 *
 * Segurança: Mascara automaticamente PII e dados sensíveis antes de gravar.
 */

type LogLevel = "INFO" | "WARN" | "ERROR";

interface LogPayload {
  timestamp: string;
  level: LogLevel;
  message: string;
  metadata?: Record<string, any>;
  error?: {
    message: string;
    stack?: string;
  };
}

/**
 * Mascara recursivamente campos de metadados que possam conter dados pessoais ou clínicos.
 */
function sanitizeMetadata(data: Record<string, any>): Record<string, any> {
  const sanitized = { ...data };
  const sensitiveKeys = [
    "email",
    "fullName",
    "name",
    "birthDate",
    "notes",
    "sensitivities",
    "interests",
    "password",
    "token",
    "apiKey",
  ];

  for (const key in sanitized) {
    if (Object.prototype.hasOwnProperty.call(sanitized, key)) {
      if (sensitiveKeys.includes(key)) {
        sanitized[key] = "[REDACTED]";
      } else if (typeof sanitized[key] === "object" && sanitized[key] !== null) {
        if (Array.isArray(sanitized[key])) {
          sanitized[key] = sanitized[key].map((item: any) =>
            typeof item === "object" && item !== null ? sanitizeMetadata(item) : item
          );
        } else {
          sanitized[key] = sanitizeMetadata(sanitized[key]);
        }
      }
    }
  }

  return sanitized;
}

function writeLog(level: LogLevel, message: string, metadata?: Record<string, any>, err?: unknown) {
  const isProduction = process.env.NODE_ENV === "production";
  
  const logPayload: LogPayload = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };

  if (metadata) {
    logPayload.metadata = sanitizeMetadata(metadata);
  }

  if (err instanceof Error) {
    logPayload.error = {
      message: err.message,
      stack: isProduction ? undefined : err.stack, // stack trace apenas em dev local para não inflar logs estruturados
    };
  } else if (err) {
    logPayload.error = {
      message: String(err),
    };
  }

  if (isProduction) {
    // Imprime em linha única JSON
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(logPayload));
  } else {
    // Legível para desenvolvedor local
    const color = level === "ERROR" ? "\x1b[31m" : level === "WARN" ? "\x1b[33m" : "\x1b[36m";
    const reset = "\x1b[0m";
    // eslint-disable-next-line no-console
    console.log(
      `[${logPayload.timestamp}] [${color}${level}${reset}] ${message}`,
      metadata ? `\n  Metadata: ${JSON.stringify(logPayload.metadata, null, 2)}` : "",
      err ? `\n  Error: ${logPayload.error?.message}` : ""
    );
  }
}

export const logger = {
  info: (message: string, metadata?: Record<string, any>) => {
    writeLog("INFO", message, metadata);
  },
  warn: (message: string, metadata?: Record<string, any>, err?: unknown) => {
    writeLog("WARN", message, metadata, err);
  },
  error: (message: string, metadata?: Record<string, any>, err?: unknown) => {
    writeLog("ERROR", message, metadata, err);
  },
};
