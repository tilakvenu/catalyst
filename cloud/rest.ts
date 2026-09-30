// Minimal Parse REST client for local scripts (schema, seed, verify, cheat tests).
// Errors carry the HTTP status and Parse's message only; request headers (keys) are never included.
import { redact, type CloudEnv } from "./env.ts";

export type Auth = { kind: "master" } | { kind: "client"; sessionToken?: string };

export class ParseError extends Error {
  status: number;
  code: number | undefined;
  constructor(status: number, code: number | undefined, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function makeRest(env: CloudEnv) {
  async function request<T = any>(method: string, route: string, body?: unknown, auth: Auth = { kind: "master" }): Promise<T> {
    const headers: Record<string, string> = {
      "X-Parse-Application-Id": env.PARSE_APP_ID,
      "Content-Type": "application/json",
    };
    if (auth.kind === "master") headers["X-Parse-Master-Key"] = env.PARSE_MASTER_KEY;
    else {
      headers["X-Parse-JavaScript-Key"] = env.PARSE_JS_KEY;
      if (auth.sessionToken) headers["X-Parse-Session-Token"] = auth.sessionToken;
    }
    const res = await fetch(env.PARSE_SERVER_URL + route.replace(/^\//, ""), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json: any;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { error: text.slice(0, 200) };
    }
    if (!res.ok) {
      const msg = `${method} ${route} -> ${res.status} ${json.code ?? ""} ${json.error ?? ""}`.trim();
      throw new ParseError(res.status, json.code, redact(msg, env));
    }
    return json as T;
  }
  return { request };
}
