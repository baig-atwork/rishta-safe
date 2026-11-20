import type { z } from "zod";

/**
 * Raised when the real backend answers in a shape this adapter does not understand. It is caught in
 * `callBackend` and turned into a 502 problem, so a contract drift shows up as one named error, not as a
 * half-rendered page or an undefined access deep in a component.
 */
export class AdapterError extends Error {
  readonly where: string;

  constructor(where: string, message: string) {
    super(message);
    this.name = "AdapterError";
    this.where = where;
  }
}

/** Validates unknown JSON against a schema of the real backend's response; throws AdapterError with the failing paths. */
export function parseReal<S extends z.ZodType>(schema: S, body: unknown, where: string): z.output<S> {
  const result = schema.safeParse(body);
  if (result.success) return result.data;
  const issues = result.error.issues
    .slice(0, 4)
    .map((issue) => `${issue.path.map(String).join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
  throw new AdapterError(where, `Unexpected backend shape for ${where}: ${issues}`);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
