// Serves profile photos from the private R2 bucket, resized on the way. The
// binding is the credential, so the bucket needs no public URL.

type R2ObjectBody = {
  body: ReadableStream;
  httpMetadata?: { contentType?: string };
};

type ImagesBinding = {
  input(stream: ReadableStream): {
    transform(options: Record<string, unknown>): {
      output(options: Record<string, unknown>): Promise<{ response(): Response }>;
    };
  };
};

export type Env = {
  PHOTOS: { get(key: string): Promise<R2ObjectBody | null> };
  IMAGES: ImagesBinding;
};

// The deck is roughly 95% of image traffic, so thumb decides the bill.
const VARIANTS: Record<string, Record<string, unknown>> = {
  thumb: { width: 200, height: 200, fit: 'cover' },
  medium: { width: 600 },
  full: { width: 1080 },
};

const QUALITY: Record<string, number> = { thumb: 75, medium: 80, full: 82 };

// verification/ holds selfies, which are moderator-only through a signed URL.
// Serving any key would hand somebody's face to anyone who learned one.
const SERVABLE_PREFIX = 'quarantine/';

function deny(status: number): Response {
  return new Response(null, { status, headers: { 'X-Robots-Tag': 'noindex' } });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return deny(405);
    }

    const path = new URL(request.url).pathname.slice(1);
    const separator = path.indexOf('/');

    if (separator < 1) {
      return deny(404);
    }

    const variant = path.slice(0, separator);
    const key = decodeURIComponent(path.slice(separator + 1));

    if (!(variant in VARIANTS) || !key.startsWith(SERVABLE_PREFIX)) {
      return deny(404);
    }

    const object = await env.PHOTOS.get(key);

    if (!object) {
      return deny(404);
    }

    // Falls back to the stored bytes rather than throwing. A transform needs
    // Images enabled on the zone, and when it is not the binding raises, which
    // reached the app as a 500 and an empty photo slot with no explanation.
    // The client already resizes to about 200KB before upload, so the original
    // is a reasonable thing to serve while that is being sorted out.
    let source: Response;

    try {
      const transformed = await env.IMAGES.input(object.body)
        .transform(VARIANTS[variant])
        .output({ format: 'image/webp', quality: QUALITY[variant] });

      source = transformed.response();
    } catch (error) {
      console.error('transform failed', variant, error instanceof Error ? error.message : error);

      const original = await env.PHOTOS.get(key);

      if (!original) {
        return deny(404);
      }

      source = new Response(original.body, {
        headers: { 'Content-Type': original.httpMetadata?.contentType ?? 'image/jpeg' },
      });
    }

    const response = new Response(source.body, source);

    // Keys are random and an object at one is never rewritten.
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    response.headers.set('X-Robots-Tag', 'noindex, noimageindex');

    return response;
  },
};
