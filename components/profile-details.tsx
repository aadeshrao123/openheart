import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card, Text } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatHeight } from '@/lib/format';
import { LIFESTYLE_FIELDS } from '@/lib/profile-options';

export type ProfileFacts = {
  height_cm: number | null;
  relationship_intent: string | null;
  drinking: string | null;
  smoking: string | null;
  exercise: string | null;
  children: string | null;
  education: string | null;
  job_title: string | null;
  interests: string[] | null;
  prompts?: unknown;
};

export type PromptView = { prompt: string; answer: string };

// discover_profiles returns prompts as jsonb, which arrives as unknown. A
// malformed row must not take the deck down with it.
export function readPrompts(value: unknown): PromptView[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) {
      return [];
    }

    const { prompt, answer } = entry as Record<string, unknown>;

    return typeof prompt === 'string' && typeof answer === 'string' ? [{ prompt, answer }] : [];
  });
}

function Pill({ label }: { label: string }) {
  return (
    <View className="rounded-control border border-border bg-surface px-3 py-1.5">
      <Text variant="caption" font="emphasis">
        {label}
      </Text>
    </View>
  );
}

export type ProfileDetailsProps = {
  profile: ProfileFacts;
  className?: string;
};

// Everything a profile carries beyond a name, an age and a bio. Renders nothing
// at all when a profile has filled none of it in, rather than a row of empty
// headings.
export function ProfileDetails({ profile, className }: ProfileDetailsProps) {
  const { t } = useTranslation();

  const facts: string[] = [];

  if (profile.height_cm !== null) {
    facts.push(formatHeight(profile.height_cm));
  }

  if (profile.job_title) {
    facts.push(profile.job_title);
  }

  if (profile.education) {
    facts.push(t(`profile.education_${profile.education}`));
  }

  if (profile.relationship_intent) {
    facts.push(t(`profile.intent_${profile.relationship_intent}`));
  }

  if (profile.children) {
    facts.push(t(`profile.children_${profile.children}`));
  }

  for (const { field, summary } of LIFESTYLE_FIELDS) {
    const value = profile[field];

    if (value && value !== 'prefer_not_say') {
      facts.push(t(summary, { value: t(`profile.frequency_${value}`) }));
    }
  }

  const interests = profile.interests ?? [];
  const prompts = readPrompts(profile.prompts);

  if (facts.length === 0 && interests.length === 0 && prompts.length === 0) {
    return null;
  }

  return (
    <View className={cn('gap-6', className)}>
      {facts.length > 0 ? (
        <View className="flex-row flex-wrap gap-2">
          {facts.map((fact) => (
            <Pill key={fact} label={fact} />
          ))}
        </View>
      ) : null}

      {interests.length > 0 ? (
        <View className="gap-3">
          <Text variant="overline" tone="subtle">
            {t('profile.interests')}
          </Text>

          <View className="flex-row flex-wrap gap-2">
            {interests.map((interest) => (
              <Pill key={interest} label={t(`profile.interest_${interest}`)} />
            ))}
          </View>
        </View>
      ) : null}

      {prompts.map((entry) => (
        <Card key={entry.prompt} elevation="flat" className="gap-2">
          <Text variant="overline" tone="accent">
            {t(`profile.prompt_${entry.prompt}`)}
          </Text>

          <Text variant="quote">{entry.answer}</Text>
        </Card>
      ))}
    </View>
  );
}
