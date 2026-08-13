import { supabase } from '@/lib/supabase';

// The shape errorResponse() in supabase/functions/_shared/http.ts sends. Both
// callers used to read `code`, which is never present, so every failure
// reached the UI as internal_error.
type FunctionError = { error: string };

export function functionErrorCode(parsed: unknown): string | null {
  if (typeof parsed !== 'object' || parsed === null) {
    return null;
  }

  const code = (parsed as FunctionError).error;

  return typeof code === 'string' && code.length > 0 ? code : null;
}

export async function callFunction<T>(
  name: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body });

  if (error) {
    // invoke() reports a non-2xx as a generic FunctionsHttpError and leaves the
    // body on error.context.
    const response = (error as { context?: Response }).context;
    const parsed: unknown = response ? await response.json().catch(() => null) : null;

    throw new Error(functionErrorCode(parsed) ?? 'internal_error');
  }

  if (data === null) {
    throw new Error('internal_error');
  }

  return data;
}
