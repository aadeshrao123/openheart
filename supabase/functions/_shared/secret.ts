import { requireEnv } from './env.ts';

// Compared at full length so the duration cannot be used to learn how much of
// the secret a caller got right.
//
// The length check in front leaks the length and nothing else, which is not
// worth defending: these are fixed-length secrets and a caller who guesses the
// length has learned a constant.
export function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let difference = 0;

  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return difference === 0;
}

// For the functions no user ever calls. Nothing about them is per user and
// they must not be callable by whoever happens to be signed in, so a shared
// secret in a header is the whole check.
//
// requireEnv throws on an empty string as well as an absent one, which is what
// makes this fail closed: a secret accidentally set to '' would otherwise match
// a request that sent no header at all.
export function hasSecret(request: Request, header: string, variable: string): boolean {
  return timingSafeEqual(request.headers.get(header) ?? '', requireEnv(variable));
}
