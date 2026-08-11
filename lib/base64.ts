const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const LOOKUP = new Uint8Array(128);

for (let index = 0; index < ALPHABET.length; index += 1) {
  LOOKUP[ALPHABET.charCodeAt(index)] = index;
}

// Hand-rolled because atob does not exist in React Native. tsconfig includes the
// DOM lib, so calling it typechecks and then throws on a device, which is the
// worst version of this mistake.
// Uint8Array<ArrayBuffer>, not a bare Uint8Array: the default parameter is
// ArrayBufferLike, which does not satisfy BodyInit, so the result could not be
// handed to fetch without a cast.
export function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  // Also drops padding, newlines and any data-URI prefix remnants.
  const input = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = new Uint8Array(Math.floor((input.length * 6) / 8));

  let value = 0;
  let bits = 0;
  let out = 0;

  for (let index = 0; index < input.length; index += 1) {
    value = (value << 6) | LOOKUP[input.charCodeAt(index)];
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      bytes[out] = (value >> bits) & 0xff;
      out += 1;
    }
  }

  return bytes;
}
