import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import * as Linking from 'expo-linking';
import { Link, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useTranslation } from 'react-i18next';
import { Button, Card, Chip, Icon, Logo, Screen, Text } from '@/components/ui';
import { cn } from '@/lib/cn';
import {
  APP_NAME,
  DELETION_URL,
  PRIVACY_POLICY_URL,
  REPOSITORY_URL,
  SUPPORT_EMAIL,
  TERMS_URL,
} from '@/lib/app';

// The web front door, and the only screen written for somebody who has not
// signed up. It is also what the static export renders for the root URL, so it
// is the whole site to a crawler that does not run JavaScript.
//
// Every animation here is behind motion-safe, so a reader who has asked their
// system for reduced motion gets the finished layout with nothing moving.

// Held as full key strings rather than assembled from a suffix so the
// translation key test can see them.
const COMPARED = [
  'landing.feature_likes',
  'landing.feature_reach',
  'landing.feature_receipts',
  'landing.feature_filters',
  'landing.feature_ads',
];

const PRINCIPLES = [
  { title: 'landing.principle_money_title', body: 'landing.principle_money_body' },
  { title: 'landing.principle_safety_title', body: 'landing.principle_safety_body' },
  { title: 'landing.principle_data_title', body: 'landing.principle_data_body' },
];

const STEPS = [
  { title: 'landing.step_verify_title', body: 'landing.step_verify_body' },
  { title: 'landing.step_browse_title', body: 'landing.step_browse_body' },
  { title: 'landing.step_talk_title', body: 'landing.step_talk_body' },
];

const SAFEGUARDS = [
  'landing.safety_scanning',
  'landing.safety_blocking',
  'landing.safety_queue',
  'landing.safety_location',
];

const TRUST = ['landing.trust_age', 'landing.trust_card', 'landing.trust_source'];

function Section({ className, children }: { className?: string; children: ReactNode }) {
  return <View className={cn('w-full max-w-page self-center px-6', className)}>{children}</View>;
}

function ExternalLink({ label, url }: { label: string; url: string }) {
  return (
    <Text
      variant="caption"
      tone="muted"
      accessibilityRole="link"
      className="transition hover:text-fg"
      onPress={() => {
        void Linking.openURL(url);
      }}
    >
      {label}
    </Text>
  );
}

// A small capsule for the trust row and the section eyebrows.
function Pill({ label, tone = 'accent' }: { label: string; tone?: 'accent' | 'brand' }) {
  return (
    <View
      className={cn(
        'flex-row items-center gap-2 rounded-control border px-3 py-1.5',
        tone === 'brand' ? 'border-brand/30 bg-brand-subtle' : 'border-border bg-surface',
      )}
    >
      <View
        className={cn('h-1.5 w-1.5 rounded-full', tone === 'brand' ? 'bg-brand' : 'bg-accent')}
      />

      <Text variant="caption" tone={tone === 'brand' ? 'brand' : 'muted'} font="emphasis">
        {label}
      </Text>
    </View>
  );
}

// Two cards leaning towards each other with a heart between them. Abstract on
// purpose: a mocked up profile would be an invented person with an invented
// face, on the landing page of an app whose whole argument is that it does not
// do that.
const CARD =
  'h-44 w-32 items-center justify-center rounded-card border border-border bg-surface-raised';

function ConnectionMark() {
  return (
    <View className="relative h-80 w-full items-center justify-center">
      <View className="pointer-events-none absolute items-center justify-center">
        <View
          className={cn(
            'h-72 w-72 rounded-full bg-brand opacity-20 blur-3xl',
            'motion-safe:animate-breathe',
          )}
        />
      </View>

      <View className="flex-row items-center justify-center">
        <View className={cn(CARD, '-rotate-6 motion-safe:animate-drift')}>
          <View className="h-14 w-14 rounded-full bg-brand-subtle" />
          <View className="mt-4 h-2 w-16 rounded-full bg-border" />
          <View className="mt-2 h-2 w-10 rounded-full bg-border" />
        </View>

        <View
          className={cn(
            'z-10 -mx-5 h-16 w-16 items-center justify-center rounded-full',
            'border border-border bg-bg motion-safe:animate-beat',
          )}
        >
          <Logo size={30} />
        </View>

        <View className={cn(CARD, 'rotate-6 motion-safe:animate-drift-slow')}>
          <View className="h-14 w-14 rounded-full bg-accent-subtle" />
          <View className="mt-4 h-2 w-16 rounded-full bg-border" />
          <View className="mt-2 h-2 w-10 rounded-full bg-border" />
        </View>
      </View>
    </View>
  );
}

// The argument the whole project rests on, made touchable rather than asserted.
// Reading the same five rows under the other heading is the point.
function Comparison() {
  const { t } = useTranslation();
  const [mine, setMine] = useState(true);

  return (
    <Card className="gap-6 shadow-lg shadow-shadow/10">
      <View className="flex-row gap-2">
        <Chip
          mode="radio"
          className="flex-1"
          label={t('landing.compare_other')}
          selected={!mine}
          onPress={() => setMine(false)}
        />

        <Chip
          mode="radio"
          className="flex-1"
          label={t('landing.compare_ours', { appName: APP_NAME })}
          selected={mine}
          onPress={() => setMine(true)}
        />
      </View>

      <View className="gap-1">
        {COMPARED.map((feature) => (
          <View
            key={feature}
            className={cn(
              'flex-row items-center gap-3 rounded-control px-3 py-3 transition',
              mine ? 'bg-brand-subtle/40' : 'bg-transparent',
            )}
          >
            <View
              className={cn(
                'h-7 w-7 items-center justify-center rounded-full',
                mine ? 'bg-brand' : 'bg-surface',
              )}
            >
              <Icon
                name={mine ? 'check' : 'close'}
                size="sm"
                className={mine ? 'text-fg-inverted' : 'text-fg-subtle'}
              />
            </View>

            <Text variant="body" font="emphasis" className="flex-1">
              {t(feature)}
            </Text>

            <Text variant="caption" tone={mine ? 'brand' : 'subtle'} font="strong">
              {t(mine ? 'landing.state_included' : 'landing.state_paid')}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

export function LandingView() {
  const { t } = useTranslation();
  const router = useRouter();

  const start = () => router.push('/sign-in');
  const openSource = () => {
    void Linking.openURL(REPOSITORY_URL);
  };

  return (
    <>
      {/* The tab title and the one a search result shows. The root layout sets
          the bare app name, and helmet takes the deepest of the two. */}
      <Head>
        <title>{t('landing.page_title', { appName: APP_NAME })}</title>
      </Head>

      <Screen scroll width="full" padded={false}>
        <View className="w-full border-b border-border/60 bg-bg/80 backdrop-blur">
          <Section className="flex-row items-center justify-between py-4">
            <View className="flex-row items-center gap-2.5">
              <Logo size={24} />

              <Text variant="heading" font="display">
                {APP_NAME}
              </Text>
            </View>

            <View className="flex-row items-center gap-5">
              <Text
                variant="label"
                tone="muted"
                accessibilityRole="link"
                className="hidden transition hover:text-fg sm:flex"
                onPress={openSource}
              >
                {t('landing.cta_source')}
              </Text>

              <Link href="/sign-in" asChild>
                <Text
                  variant="label"
                  tone="brand"
                  font="strong"
                  className="transition hover:opacity-70"
                >
                  {t('auth.sign_in')}
                </Text>
              </Link>
            </View>
          </Section>
        </View>

        <View className="w-full overflow-hidden">
          <Section className="pb-24 pt-16 lg:pt-24">
            <View className="gap-16 lg:flex-row lg:items-center lg:gap-20">
              <View className="flex-1 gap-7">
                <View className="flex-row motion-safe:animate-fade-up">
                  <Pill label={t('landing.eyebrow')} tone="brand" />
                </View>

                <Text variant="display" className="motion-safe:animate-fade-up-1 lg:text-hero">
                  {t('landing.headline')}
                </Text>

                <Text
                  variant="body"
                  tone="muted"
                  className="max-w-prose motion-safe:animate-fade-up-2"
                >
                  {t('landing.subhead', { appName: APP_NAME })}
                </Text>

                <View className="gap-3 motion-safe:animate-fade-up-3 sm:flex-row">
                  <Button
                    label={t('landing.cta_start')}
                    size="lg"
                    className="transition hover:opacity-90"
                    onPress={start}
                  />

                  <Button
                    variant="secondary"
                    size="lg"
                    label={t('landing.cta_source')}
                    className="transition hover:opacity-90"
                    onPress={openSource}
                  />
                </View>

                <View className="flex-row flex-wrap gap-2 motion-safe:animate-fade-up-4">
                  {TRUST.map((key) => (
                    <Pill key={key} label={t(key)} />
                  ))}
                </View>
              </View>

              <View className="flex-1 motion-safe:animate-fade-in-slow">
                <ConnectionMark />
              </View>
            </View>
          </Section>
        </View>

        <View className="w-full bg-surface py-24">
          <Section className="gap-12">
            <View className="max-w-prose gap-4">
              <Text variant="overline" tone="accent">
                {t('landing.compare_eyebrow')}
              </Text>

              <Text variant="title">{t('landing.compare_title')}</Text>

              <Text variant="body" tone="muted">
                {t('landing.compare_body')}
              </Text>
            </View>

            <View className="w-full max-w-content self-center">
              <Comparison />
            </View>
          </Section>
        </View>

        <Section className="gap-12 py-24">
          <View className="max-w-prose gap-4">
            <Text variant="overline" tone="accent">
              {t('landing.principles_eyebrow')}
            </Text>

            <Text variant="title">{t('landing.principles_title')}</Text>

            <Text variant="body" tone="muted">
              {t('landing.principles_body')}
            </Text>
          </View>

          <View className="gap-5 lg:flex-row">
            {PRINCIPLES.map((principle) => (
              <Card
                key={principle.title}
                className="flex-1 gap-4 transition hover:-translate-y-1 hover:border-brand/40"
              >
                <View
                  className="h-10 w-10 items-center justify-center rounded-full bg-brand-subtle"
                >
                  <Logo size={18} />
                </View>

                <Text variant="heading">{t(principle.title)}</Text>

                <Text variant="body" tone="muted">
                  {t(principle.body)}
                </Text>
              </Card>
            ))}
          </View>
        </Section>

        <View className="w-full bg-surface py-24">
          <Section className="gap-12">
            <View className="max-w-prose gap-4">
              <Text variant="overline" tone="accent">
                {t('landing.steps_eyebrow')}
              </Text>

              <Text variant="title">{t('landing.steps_title')}</Text>
            </View>

            <View className="gap-5 lg:flex-row">
              {STEPS.map((step, index) => (
                <Card
                  key={step.title}
                  elevation="raised"
                  className="flex-1 gap-4 transition hover:-translate-y-1"
                >
                  <View className="h-9 w-9 items-center justify-center rounded-full bg-brand">
                    <Text variant="label" tone="inverted" font="strong">
                      {t('landing.step_number', { step: index + 1 })}
                    </Text>
                  </View>

                  <Text variant="heading">{t(step.title)}</Text>

                  <Text variant="body" tone="muted">
                    {t(step.body)}
                  </Text>
                </Card>
              ))}
            </View>
          </Section>
        </View>

        <Section className="gap-12 py-24">
          <View className="max-w-prose gap-4">
            <Text variant="overline" tone="accent">
              {t('landing.safety_eyebrow')}
            </Text>

            <Text variant="title">{t('landing.safety_title')}</Text>

            <Text variant="body" tone="muted">
              {t('landing.safety_body')}
            </Text>
          </View>

          {/* Two explicit columns rather than flex-wrap with a width. Wrapping
              a half-width item next to a gap needs w-[calc(50%-8px)], and an
              arbitrary value in a component is the same defect as a hex code. */}
          <View className="gap-4 lg:flex-row">
            {[SAFEGUARDS.slice(0, 2), SAFEGUARDS.slice(2)].map((column) => (
              <View key={column[0]} className="flex-1 gap-4">
                {column.map((safeguard) => (
                  <Card key={safeguard} elevation="flat" className="flex-row items-start gap-4">
                    <View
                      className={cn(
                        'mt-0.5 h-6 w-6 items-center justify-center',
                        'rounded-full bg-success/15',
                      )}
                    >
                      <Icon name="check" size="sm" className="text-success" />
                    </View>

                    <Text variant="body" className="flex-1">
                      {t(safeguard)}
                    </Text>
                  </Card>
                ))}
              </View>
            ))}
          </View>
        </Section>

        <View className="w-full overflow-hidden bg-brand-subtle py-24">
          <Section className="items-center gap-7">
            <Logo size={40} />

            <Text variant="title" className="max-w-prose text-center">
              {t('landing.open_title')}
            </Text>

            <Text variant="body" tone="muted" className="max-w-prose text-center">
              {t('landing.open_body', { appName: APP_NAME })}
            </Text>

            <View className="gap-3 sm:flex-row">
              <Button
                label={t('landing.cta_start')}
                size="lg"
                className="transition hover:opacity-90"
                onPress={start}
              />

              <Button
                variant="secondary"
                size="lg"
                label={t('landing.cta_source')}
                className="transition hover:opacity-90"
                onPress={openSource}
              />
            </View>
          </Section>
        </View>

        <View className="w-full border-t border-border">
          <Section className="gap-6 py-12">
            <View className="flex-row items-center gap-2.5">
              <Logo size={20} />

              <Text variant="label" font="display">
                {APP_NAME}
              </Text>
            </View>

            <View className="flex-row flex-wrap items-center gap-x-6 gap-y-3">
              <ExternalLink label={t('settings.privacy_policy')} url={PRIVACY_POLICY_URL} />
              <ExternalLink label={t('settings.terms')} url={TERMS_URL} />
              <ExternalLink label={t('settings.danger_zone')} url={DELETION_URL} />
              <ExternalLink label={t('landing.cta_source')} url={REPOSITORY_URL} />
              <ExternalLink label={t('settings.contact')} url={`mailto:${SUPPORT_EMAIL}`} />
            </View>

            <Text variant="caption" tone="subtle">
              {t('landing.footer_note')}
            </Text>
          </Section>
        </View>
      </Screen>
    </>
  );
}
