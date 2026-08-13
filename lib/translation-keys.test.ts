// The only file in the project that reads the filesystem, so node's types are
// pulled in here rather than added to the whole program through tsconfig.
/// <reference types="node" />

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

// profile-options.ts reaches format.ts, which imports expo-localization and
// with it React Native's Flow source that Vitest cannot parse. Nothing here
// formats anything; the mock only has to exist. Same reason and same shape as
// lib/profile-options.test.ts.
vi.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US', languageCode: 'en' }],
}));

import en from '@/locales/en.json';
import { Constants } from '@/lib/database.types';
import {
  CHILDREN_OPTIONS,
  EDUCATION_LEVELS,
  GENDERS,
  INTERESTS,
  LIFESTYLE_FREQUENCIES,
  PROMPTS,
  RELATIONSHIP_INTENTS,
} from '@/lib/profile-options';
import { REACTION_CODES } from '@/lib/reactions';
import { REPORT_REASONS } from '@/lib/report-reasons';
import {
  VERIFICATION_CHALLENGES,
  VERIFICATION_REASONS,
  VERIFICATION_RESULTS,
} from '@/lib/verification';

// A mistyped key is invisible: i18next renders the key itself, so the screen
// says "matches.emty" instead of a sentence and nothing fails. This walks the
// source the way i18next would and asserts every key it could ask for exists.

const ROOT = path.resolve(import.meta.dirname, '..');

const SOURCE_DIRECTORIES = ['app', 'components', 'hooks', 'lib'];

// i18next appends a CLDR plural category to the key it looks up, so a call site
// asking for matches.count is satisfied by matches.count_one plus
// matches.count_other and never by a key of that exact name.
const PLURAL_SUFFIXES = ['zero', 'one', 'two', 'few', 'many', 'other'];

// Keys assembled from a value rather than written out. The prefix is what the
// scanner can see; the list is what the running app can actually produce, taken
// from the same constant the call site uses so the two cannot drift.
// A pending report renders its action buttons and never asks for a status
// label, which is the same thing Exclude<ReportStatus, 'pending'> says in the
// hook that writes one.
const RESOLVED_STATUSES = Constants.public.Enums.report_status.filter(
  (status) => status !== 'pending',
);

const DYNAMIC_KEYS: Record<string, readonly string[]> = {
  'safety.reason_': REPORT_REASONS,
  'chat.reaction_': REACTION_CODES,
  'profile.gender_': GENDERS,
  'profile.intent_': RELATIONSHIP_INTENTS,
  'profile.frequency_': LIFESTYLE_FREQUENCIES,
  'profile.children_': CHILDREN_OPTIONS,
  'profile.education_': EDUCATION_LEVELS,
  'profile.interest_': INTERESTS,
  'profile.prompt_': PROMPTS,
  'moderation.status_': RESOLVED_STATUSES,
  'verify.pose_': VERIFICATION_CHALLENGES,
  'verify.result_': VERIFICATION_RESULTS,
  'verify.result_body_': VERIFICATION_RESULTS,
  'verify.reason_': VERIFICATION_REASONS,
};

type Bundle = { [key: string]: string | Bundle };

function flatten(bundle: Bundle, prefix = ''): string[] {
  return Object.entries(bundle).flatMap(([key, value]) => {
    const full = prefix ? `${prefix}.${key}` : key;

    return typeof value === 'string' ? [full] : flatten(value, full);
  });
}

const KEYS = new Set(flatten(en));

const NAMESPACES = new Set([...KEYS].map((key) => key.split('.')[0]));

function resolves(key: string): boolean {
  if (KEYS.has(key)) {
    return true;
  }

  return PLURAL_SUFFIXES.some((suffix) => KEYS.has(`${key}_${suffix}`));
}

function sourceFiles(): string[] {
  const walk = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return walk(full);
      }

      if (!/\.tsx?$/.test(entry.name) || entry.name.endsWith('.test.ts')) {
        return [];
      }

      // Generated, gitignored, and thousands of lines of column names that the
      // namespace scan below would otherwise have to read.
      return full.endsWith('database.types.ts') ? [] : [full];
    });

  return SOURCE_DIRECTORIES.flatMap((directory) => walk(path.join(ROOT, directory)));
}

type Reference = { key: string; file: string };

const LITERAL_CALL = /\bt\(\s*(['"])([^'"]+)\1/g;
const TEMPLATE_CALL = /\bt\(\s*`([^`]*)\$\{/g;

// lib/auth-errors.ts, lib/auth-providers.ts and components/message-status.tsx
// all hold keys in a lookup and pass the value to t() somewhere else, so the
// call site alone never sees them. Anything shaped like a key whose namespace
// is real is treated as one.
const BARE_KEY = /(['"])([a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+)\1/g;

function references(): { direct: Reference[]; dynamic: Reference[] } {
  const direct: Reference[] = [];
  const dynamic: Reference[] = [];

  for (const file of sourceFiles()) {
    const source = readFileSync(file, 'utf8');
    const relative = path.relative(ROOT, file);

    for (const match of source.matchAll(LITERAL_CALL)) {
      direct.push({ key: match[2], file: relative });
    }

    for (const match of source.matchAll(BARE_KEY)) {
      if (NAMESPACES.has(match[2].split('.')[0])) {
        direct.push({ key: match[2], file: relative });
      }
    }

    for (const match of source.matchAll(TEMPLATE_CALL)) {
      dynamic.push({ key: match[1], file: relative });
    }
  }

  return { direct, dynamic };
}

const { direct, dynamic } = references();

describe('translation keys', () => {
  it('finds the call sites at all', () => {
    expect(direct.length).toBeGreaterThan(200);
    expect(dynamic.length).toBeGreaterThan(0);
  });

  it('resolves every key the source asks for', () => {
    const missing = direct
      .filter((reference) => !resolves(reference.key))
      .map((reference) => `${reference.file}: ${reference.key}`);

    expect([...new Set(missing)]).toEqual([]);
  });

  // A new family of assembled keys has to be registered above, or the scanner
  // silently stops covering it, which is the failure this whole file exists to
  // prevent.
  it('knows every prefix the source assembles a key from', () => {
    const unregistered = dynamic
      .filter((reference) => !(reference.key in DYNAMIC_KEYS))
      .map((reference) => `${reference.file}: ${reference.key}`);

    expect([...new Set(unregistered)]).toEqual([]);
  });

  it('resolves every value an assembled key can take', () => {
    const missing = Object.entries(DYNAMIC_KEYS).flatMap(([prefix, values]) =>
      values.filter((value) => !resolves(`${prefix}${value}`)).map((value) => `${prefix}${value}`),
    );

    expect(missing).toEqual([]);
  });
});
