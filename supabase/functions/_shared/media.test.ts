import { detectImageFormat } from './media.ts';

function expect(actual: string | null, wanted: string | null, label: string): void {
  if (actual !== wanted) {
    throw new Error(`${label}: got ${actual}, wanted ${wanted}`);
  }
}

Deno.test('detectImageFormat reads the container from the leading bytes', () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  const webp = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
  ]);

  expect(detectImageFormat(jpeg), 'image/jpeg', 'jpeg');
  expect(detectImageFormat(png), 'image/png', 'png');
  expect(detectImageFormat(webp), 'image/webp', 'webp');
});

Deno.test('detectImageFormat rejects anything that is not an image', () => {
  const html = new TextEncoder().encode('<!DOCTYPE html><script>alert(1)</script>');
  const truncated = new Uint8Array([0xff, 0xd8]);
  const empty = new Uint8Array([]);

  // RIFF without the WEBP tag is a wav or avi container, not an image.
  const riffAudio = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
  ]);

  expect(detectImageFormat(html), null, 'html');
  expect(detectImageFormat(truncated), null, 'truncated');
  expect(detectImageFormat(empty), null, 'empty');
  expect(detectImageFormat(riffAudio), null, 'riff audio');
});
