export type RequestErrorKind = "timeout" | "network" | "auth" | "server" | "http";

export class RequestError extends Error {
  kind: RequestErrorKind;
  status?: number;

  constructor(kind: RequestErrorKind, message: string, status?: number) {
    super(message);
    this.name = "RequestError";
    this.kind = kind;
    this.status = status;
  }
}

/**
 * fetch() with a hard timeout via AbortController. Never hangs indefinitely.
 * Throws a typed RequestError so callers can distinguish timeout / network /
 * auth / server failures and show the right message + retry affordance.
 *
 * Note: this resolves the Response as soon as headers arrive. Callers that read
 * a large/streamed body should keep their own guard, but for our small JSON
 * payloads reading `res.json()` right after is effectively covered.
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 20000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, { ...options, signal: controller.signal });
  } catch {
    if (controller.signal.aborted) {
      throw new RequestError("timeout", `Request timed out after ${timeoutMs / 1000}s`);
    }
    throw new RequestError("network", "Network request failed — service unreachable");
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401 || res.status === 403) {
    throw new RequestError("auth", "Authentication failed", res.status);
  }
  if (res.status >= 500) {
    throw new RequestError("server", `Server error (${res.status})`, res.status);
  }
  return res;
}

/** Human-facing copy for a caught error, keyed by kind. Never leaks internals. */
export function messageForError(err: unknown, fallback: string): string {
  if (err instanceof RequestError) {
    switch (err.kind) {
      case "timeout":
        return "The request took too long. The AI service may be busy — please retry.";
      case "network":
        return "Could not reach the server. Check your connection and retry.";
      case "auth":
        return "AI service authentication failed. Ask an admin to check the server's AI provider key.";
      case "server":
        return "The AI service reported an error. Please retry in a moment.";
      default:
        return fallback;
    }
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
