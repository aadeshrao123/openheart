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
      console.error(error);
      return errorResponse('internal_error', 500);
    }
  });
}
