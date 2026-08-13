import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import * as Linking from 'expo-linking';
import { Link, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useTranslation } from 'react-i18next';
import { Button, Card, Chip, Icon, Logo, Rail, Screen, Text } from '@/components/ui';
import { cn } from '@/lib/cn';
import {
  APP_NAME,
  DELETION_URL,
  PRIVACY_POLICY_URL,
  REPOSITORY_URL,
  SUPPORT_EMAIL,
  TERMS_URL,
} from '@/lib/app';

// The web front door, and the only screen in the app written for someone who
// has not signed up. It is also what the static export renders for the root
// URL, so it is the whole site to a crawler that does not run JavaScript.

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

function Section({ className, children }: { className?: string; children: ReactNode }) {
  return <View className={cn('w-full max-w-page self-center px-6', className)}>{children}</View>;
}

function ExternalLink({ label, url }: { label: string; url: string }) {
  return (
    <Text
      variant="caption"
      tone="muted"
      accessibilityRole="link"
      className="hover:text-fg"
      onPress={() => {
        void Linking.openURL(url);
      }}
    >
      {label}
    </Text>
  );
}

// The argument the whole project rests on, made touchable rather than asserted.
// Reading the same five rows under the other heading is the point.
function Comparison() {
  const { t } = useTranslation();
  const [mine, setMine] = useState(true);

  return (
    <Card className="gap-6">
      <View className="gap-2">
        <Text variant="overline" tone="subtle">
          {t('landing.compare_title')}
        </Text>

        <Text variant="quote" tone="muted">
          {t('landing.compare_body')}
        </Text>
      </View>

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

      <View className="gap-4">
        {COMPARED.map((feature) => (
          <View key={feature} className="flex-row items-center gap-3">
            <Icon
              name={mine ? 'check' : 'close'}
              size="sm"
              className={mine ? 'text-success' : 'text-fg-subtle'}
            />

            <Text variant="body" className="flex-1">
              {t(feature)}
            </Text>

            <Text variant="caption" tone={mine ? 'default' : 'subtle'}>
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

  return (
    <>
      {/* The tab title and the one a search result shows. The root layout sets
          the bare app name, and helmet takes the deepest of the two. */}
      <Head>
        <title>{t('landing.page_title', { appName: APP_NAME })}</title>
      </Head>

      <Screen scroll width="full" padded={false}>
        <Section className="flex-row items-center justify-between py-6">
        <View className="flex-row items-center gap-3">
          <Logo size={26} />

          <Text variant="heading" font="display">
            {APP_NAME}
          </Text>
        </View>

        <Link href="/sign-in" asChild>
          <Text variant="label" tone="muted" className="hover:text-fg">
            {t('auth.sign_in')}
          </Text>
        </Link>
      </Section>

      <Section className="pb-20 pt-10">
        <View className="gap-14 lg:flex-row lg:items-center lg:gap-16">
          <View className="flex-1 gap-7">
            <Text variant="overline" tone="accent">
              {t('landing.eyebrow')}
            </Text>

            <Text variant="display" className="lg:text-hero">
              {t('landing.headline')}
            </Text>

            <Text variant="body" tone="muted" className="max-w-prose">
              {t('landing.subhead', { appName: APP_NAME })}
            </Text>

            <View className="gap-3 sm:flex-row">
              <Button label={t('landing.cta_start')} size="lg" onPress={start} />

              <Button
                variant="secondary"
                size="lg"
                label={t('landing.cta_source')}
                onPress={() => {
                  void Linking.openURL(REPOSITORY_URL);
                }}
              />
            </View>

            <Text variant="caption" tone="subtle">
              {t('landing.cta_note')}
            </Text>
          </View>

          <View className="flex-1">
            <Comparison />
          </View>
        </View>
      </Section>

      <View className="w-full bg-surface py-20">
        <Section className="gap-10">
          <View className="max-w-prose gap-3">
            <Text variant="title">{t('landing.principles_title')}</Text>

            <Text variant="body" tone="muted">
              {t('landing.principles_body')}
            </Text>
          </View>

          <View className="gap-5 lg:flex-row">
            {PRINCIPLES.map((principle) => (
              <Card key={principle.title} className="flex-1 gap-3">
                <View className="h-px w-8 bg-brand" />

                <Text variant="heading">{t(principle.title)}</Text>

                <Text variant="body" tone="muted">
                  {t(principle.body)}
                </Text>
              </Card>
            ))}
          </View>
        </Section>
      </View>

      <Section className="gap-10 py-20">
        <Text variant="title">{t('landing.steps_title')}</Text>

        <View className="gap-5 lg:flex-row">
          {STEPS.map((step) => (
            <Card key={step.title} elevation="flat" className="flex-1 gap-3">
              <Text variant="overline" tone="accent">
                {t(step.title)}
              </Text>

              <Text variant="body" tone="muted">
                {t(step.body)}
              </Text>
            </Card>
          ))}
        </View>
      </Section>

      <View className="w-full bg-surface py-20">
        <Section className="gap-8">
          <View className="max-w-prose gap-3">
            <Text variant="title">{t('landing.safety_title')}</Text>

            <Text variant="body" tone="muted">
              {t('landing.safety_body')}
            </Text>
          </View>

          <View className="gap-4">
            {SAFEGUARDS.map((safeguard) => (
              <Rail key={safeguard} tone="border" className="max-w-prose">
                <Text variant="body">{t(safeguard)}</Text>
              </Rail>
            ))}
          </View>
        </Section>
      </View>

      <Section className="gap-6 py-20">
        <View className="max-w-prose gap-4">
          <Text variant="title">{t('landing.open_title')}</Text>

          <Text variant="body" tone="muted">
            {t('landing.open_body', { appName: APP_NAME })}
          </Text>
        </View>

        <View className="gap-3 sm:flex-row">
          <Button label={t('landing.cta_start')} onPress={start} />

          <Button
            variant="secondary"
            label={t('landing.cta_source')}
            onPress={() => {
              void Linking.openURL(REPOSITORY_URL);
            }}
          />
        </View>
      </Section>

      <Section className="gap-5 border-t border-border py-10">
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
      </Screen>
    </>
  );
}
