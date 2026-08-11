import { useState } from 'react';
import { View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Screen, Text } from '@/components/ui';
import { CodeInput } from '@/components/code-input';
import { useRequestEmailCode, useVerifyEmailCode } from '@/hooks/use-auth';
import { authErrorKey } from '@/lib/auth-errors';

const CODE_LENGTH = 6;

export default function VerifyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const [code, setCode] = useState('');

  const verify = useVerifyEmailCode();
  const resend = useRequestEmailCode();

  // Reached directly, or after a reload dropped the parameter. There is nothing
  // to verify against without the address.
  if (!email) {
    return <Redirect href="/sign-in" />;
  }

  // Submitted from the change handler, never from an effect. An effect watching
  // the mutation re-runs on every render, so the moment a rejected code settled
  // it fired again with the same digits, forever: thousands of requests, a
  // tripped rate limit and a screen stuck on "checking".
  const submit = (next: string) => {
    if (next.length === CODE_LENGTH && !verify.isPending) {
      verify.mutate({ email, code: next });
    }
  };

  const errorKey = verify.isError
    ? authErrorKey(verify.error)
    : resend.isError
      ? authErrorKey(resend.error)
      : null;

  return (
    <Screen scroll className="justify-center gap-10 py-12">
      <View className="gap-3">
        <Text variant="title">{t('auth.verify_title')}</Text>
        <Text tone="muted">{t('auth.verify_body', { email })}</Text>
      </View>

      <View className="gap-4">
        <CodeInput
          label={t('auth.code_label')}
          value={code}
          length={CODE_LENGTH}
          autoFocus
          onChange={(next) => {
            // Clears a stale failure as they start correcting it, rather than
            // leaving the old error under a half-typed code.
            if (verify.isError) {
              verify.reset();
            }

            setCode(next);
            submit(next);
          }}
        />

        {errorKey ? (
          <Text variant="caption" tone="danger">
            {t(errorKey)}
          </Text>
        ) : null}

        {verify.isPending ? (
          <Text variant="caption" tone="subtle">
            {t('auth.verifying')}
          </Text>
        ) : null}
      </View>

      <View className="gap-3">
        <Button
          variant="ghost"
          label={t('auth.resend_code')}
          loading={resend.isPending}
          onPress={() => {
            setCode('');
            verify.reset();
            resend.mutate(email);
          }}
        />

        <Button
          variant="ghost"
          label={t('auth.use_different_email')}
          onPress={() => router.replace('/sign-in')}
        />
      </View>

      {resend.isSuccess && !resend.isPending ? (
        <Text variant="caption" tone="subtle">
          {t('auth.code_resent')}
        </Text>
      ) : null}
    </Screen>
  );
}
