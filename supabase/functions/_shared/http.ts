// Native builds send no Origin header and the web build is served from
// Cloudflare Pages, so an origin allowlist would need a wildcard entry anyway.
// Nothing is exposed by it: every response below is gated on a valid user JWT.
const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// The value is a stable machine code, never a sentence. The client maps it to a
// translation key, so error copy stays in locales/ like every other string.
export function errorResponse(code: string, status: number): Response {
  return jsonResponse({ error: code }, status);
}

export async function readJsonObject(
  request: Request,
): Promise<Record<string, unknown> | null> {
  const payload: unknown = await request.json().catch(() => null);

  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return null;
  }

  return payload as Record<string, unknown>;
}

// console.error(error) on its own logged `{ message: "" }` for a PostgrestError,
// which is what the README tells a maintainer to go and read. The interesting
// fields are non-enumerable or named something else, so they are pulled out by
// hand.
function describeError(error: unknown): Record<string, unknown> {
  if (typeof error !== 'object' || error === null) {
    return { value: String(error) };
  }

  const record = error as Record<string, unknown>;

  return {
    // String() and the key list are the fallback for anything that is neither an
    // Error nor a PostgrestError, which is how this arrived as `{message: ""}`
    // and told a maintainer nothing.
    raw: String(error),
    keys: Object.getOwnPropertyNames(error),
    name: record.name,
    message: record.message,
    code: record.code,
    details: record.details,
    hint: record.hint,
    status: record.status,
    stack: record.stack,
  };
}

export function serveJson(handler: (request: Request) => Promise<Response>): void {
  Deno.serve(async (request) => {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      return await handler(request);
    } catch (error) {
      // Without this the runtime returns a bare 500 with no CORS headers, and
      // the browser reports a network failure instead of the real status.
      console.error(JSON.stringify(describeError(error)));
      return errorResponse('internal_error', 500);
    }
  });
}
