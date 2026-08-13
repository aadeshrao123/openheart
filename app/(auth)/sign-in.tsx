import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Input, Rail, Screen, Text } from '@/components/ui';
import { useRequestEmailCode, useSignInWithProvider } from '@/hooks/use-auth';
import { authErrorKey } from '@/lib/auth-errors';
import { OAUTH_PROVIDERS } from '@/lib/auth-providers';
import { APP_NAME } from '@/lib/app';

export default function SignInScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState('');

  const requestCode = useRequestEmailCode();
  const signInWithProvider = useSignInWithProvider();

  // Deliberately loose. The auth server decides what a valid address is, and a
  // stricter pattern here would reject real ones, so this only catches the
  // obviously-unfinished case that would waste a round trip.
  const looksLikeEmail = /.+@.+\..+/.test(email.trim());

  const submit = () => {
    requestCode.mutate(email, {
      onSuccess: () => router.push({ pathname: '/verify', params: { email: email.trim() } }),
    });
  };

  return (
    <Screen scroll className="justify-center gap-12 py-16">
      <View className="gap-5">
        <View className="h-px w-12 bg-brand" />

        <View className="gap-3">
          <Text variant="display">{APP_NAME}</Text>
          <Text variant="quote" tone="muted">
            {t('welcome.tagline')}
          </Text>
        </View>
      </View>

      <View className="gap-4">
        <Input
          label={t('auth.email_label')}
          value={email}
          onChangeText={setEmail}
          placeholder={t('auth.email_placeholder')}
          keyboardType="email-address"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="go"
          onSubmitEditing={() => {
            if (looksLikeEmail) {
              submit();
            }
          }}
          error={requestCode.isError ? t(authErrorKey(requestCode.error)) : undefined}
        />

        <Button
          label={t('auth.send_code')}
          disabled={!looksLikeEmail}
          loading={requestCode.isPending}
          onPress={submit}
        />

        <Text variant="caption" tone="subtle" className="text-center">
          {t('auth.no_password_explainer')}
        </Text>
      </View>

      {/* Still guarded, because the list is empty until a provider is both
          configured in Supabase and added to it, and a button that opens a
          browser onto an error is worse than no button. */}
      {OAUTH_PROVIDERS.length > 0 ? (
        <View className="gap-3">
          {OAUTH_PROVIDERS.map((provider) => (
            <Button
              key={provider.id}
              variant="secondary"
              label={t(provider.labelKey)}
              loading={signInWithProvider.isPending}
              onPress={() => signInWithProvider.mutate(provider.id)}
            />
          ))}
        </View>
      ) : null}

      <Rail tone="accent" className="gap-5">
        <Text variant="overline" tone="accent">
          {t('welcome.promise_title')}
        </Text>
        <Text variant="quote" tone="default">
          {t('welcome.promise_body')}
        </Text>
      </Rail>

      <Text variant="caption" tone="subtle">
        {t('auth.age_gate', { appName: APP_NAME })}
      </Text>
    </Screen>
  );
}
