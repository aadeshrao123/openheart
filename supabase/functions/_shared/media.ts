// A presigned PUT carries no size policy, so the ceiling can only be enforced
// after the fact. The client resizes to roughly 200KB before uploading; this
// exists to catch a caller that ignores the client and fills the bucket.
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const JPEG_MAGIC = [0xff, 0xd8, 0xff];
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const RIFF_MAGIC = [0x52, 0x49, 0x46, 0x46];
const WEBP_MAGIC = [0x57, 0x45, 0x42, 0x50];

function hasMagic(bytes: Uint8Array, magic: number[], offset: number): boolean {
  if (bytes.length < offset + magic.length) {
    return false;
  }

  return magic.every((byte, index) => bytes[offset + index] === byte);
}

// The content type a client declares is not covered by the upload signature, so
// the bytes are the only trustworthy statement of what was actually stored.
export function detectImageFormat(bytes: Uint8Array): string | null {
  if (hasMagic(bytes, JPEG_MAGIC, 0)) {
    return 'image/jpeg';
  }

  if (hasMagic(bytes, PNG_MAGIC, 0)) {
    return 'image/png';
  }

  if (hasMagic(bytes, RIFF_MAGIC, 0) && hasMagic(bytes, WEBP_MAGIC, 8)) {
    return 'image/webp';
  }

  return null;
}
