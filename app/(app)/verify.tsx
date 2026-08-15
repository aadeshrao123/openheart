import { useRef, useState } from 'react';
import { View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Card, Rail, Screen, Text } from '@/components/ui';
import { RATE_LIMITED } from '@/lib/db-errors';
import { haptics } from '@/lib/haptics';
import {
  useLatestVerification,
  useStartVerification,
  useSubmitVerification,
  type VerificationChallenge,
} from '@/hooks/use-verification';
import { useMyProfile } from '@/hooks/use-my-profile';

type Stage = 'consent' | 'capture' | 'result';

type Pose = { challenge: VerificationChallenge; uploadUrl: string };

type Attempt = { id: string; poses: Pose[] };

export default function VerifyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: profile } = useMyProfile();
  const { data: latest } = useLatestVerification();

  const [stage, setStage] = useState<Stage>('consent');
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [taken, setTaken] = useState<string[]>([]);
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);

  const start = useStartVerification();
  const submit = useSubmitVerification();

  const begin = () => {
    start.mutate(undefined, {
      onSuccess: (issued) => {
        setAttempt({
          id: issued.attempt_id,
          poses: [
            { challenge: issued.challenge, uploadUrl: issued.upload_url },
            { challenge: issued.challenge_two, uploadUrl: issued.upload_url_two },
          ],
        });

        setTaken([]);
        setStage('capture');
      },
    });
  };

  const restart = () => {
    submit.reset();
    start.reset();
    setAttempt(null);
    setTaken([]);
    setStage('consent');
  };

  const capture = async () => {
    if (!camera.current || !attempt) {
      return;
    }

    const photo = await camera.current.takePictureAsync({ quality: 0.8 });

    if (!photo) {
      return;
    }

    const captured = [...taken, photo.uri];

    // Nothing is uploaded until both poses are held. Judging the first on its
    // own would tell somebody it passed, and that feedback is what makes
    // guessing the pair worth trying.
    if (captured.length < attempt.poses.length) {
      setTaken(captured);
      return;
    }

    submit.mutate(
      {
        attemptId: attempt.id,
        captures: attempt.poses.map((pose, index) => ({
          uploadUrl: pose.uploadUrl,
          uri: captured[index],
        })),
      },
      {
        onSuccess: (outcome) => {
          if (outcome.status === 'passed') {
            haptics.matchMade();
          }

          setStage('result');
        },
        onError: () => setStage('result'),
      },
    );
  };

  if (profile?.photo_verified) {
    return (
      <Screen scroll className="gap-6 py-6">
        <Text variant="title">{t('verify.title')}</Text>

        <Card elevation="flat" className="gap-2">
          <Text variant="label" tone="accent">
            {t('verify.already_title')}
          </Text>
          <Text tone="muted">{t('verify.already_body')}</Text>
        </Card>

        <Button variant="secondary" label={t('common.back')} onPress={() => router.back()} />
      </Screen>
    );
  }

  if (stage === 'consent') {
    const startError = () => {
      if (!start.isError) {
        return undefined;
      }

      if (start.error.message === RATE_LIMITED) {
        return t('verify.rate_limited');
      }

      return start.error.message === 'no_approved_photos'
        ? t('verify.needs_photos')
        : t('common.error_generic');
    };

    return (
      <Screen scroll className="gap-6 py-6">
        <View className="gap-2">
          <View className="h-px w-12 bg-brand" />
          <Text variant="title">{t('verify.title')}</Text>
          <Text tone="muted">{t('verify.why')}</Text>
        </View>

        {/* Everything that happens to the selfie, before the camera opens.
            Consent to biometric processing has to be given before the capture,
            not after it, and it has to say what is kept. */}
        <Rail tone="accent">
          <View className="gap-3">
            <Text variant="overline" tone="accent">
              {t('verify.consent_title')}
            </Text>
            <Text>{t('verify.consent_compare')}</Text>
            <Text>{t('verify.consent_deleted')}</Text>
            <Text>{t('verify.consent_stored')}</Text>
            <Text>{t('verify.consent_human')}</Text>
          </View>
        </Rail>

        {latest?.status === 'review' ? (
          <Card elevation="flat">
            <Text tone="muted">{t('verify.in_review')}</Text>
          </Card>
        ) : null}

        {startError() ? (
          <Text variant="caption" tone="danger" role="alert">
            {startError()}
          </Text>
        ) : null}

        <Button
          label={t('verify.consent_agree')}
          loading={start.isPending}
          onPress={begin}
        />

        <Button variant="ghost" label={t('common.back')} onPress={() => router.back()} />
      </Screen>
    );
  }

  if (stage === 'capture' && attempt) {
    if (!permission?.granted) {
      return (
        <Screen className="justify-center gap-5">
          <Text variant="title">{t('verify.camera_title')}</Text>
          <Text tone="muted">{t('verify.camera_body')}</Text>

          <Button label={t('verify.camera_allow')} onPress={() => void requestPermission()} />

          <Button variant="ghost" label={t('common.cancel')} onPress={restart} />
        </Screen>
      );
    }

    const step = taken.length;
    const pose = attempt.poses[step];

    return (
      <Screen className="justify-center gap-5">
        <View className="gap-2">
          <Text variant="overline" tone="accent">
            {t('verify.pose_step', { step: step + 1, total: attempt.poses.length })}
          </Text>
          <Text variant="title">{t(`verify.pose_${pose.challenge}`)}</Text>
        </View>

        <Text tone="muted">{t('verify.pose_hint')}</Text>

        <View className="aspect-card overflow-hidden rounded-card bg-surface">
          <CameraView ref={camera} facing="front" style={{ flex: 1 }} />
        </View>

        {/* The next pose is named before this one is taken. Springing it
            afterwards would read as a trick being played on somebody who is
            only trying to prove they are real. */}
        {attempt.poses[step + 1] ? (
          <Text variant="caption" tone="subtle">
            {t('verify.pose_next', {
              pose: t(`verify.pose_${attempt.poses[step + 1].challenge}`),
            })}
          </Text>
        ) : null}

        <Button
          label={step + 1 < attempt.poses.length ? t('verify.capture_next') : t('verify.capture')}
          loading={submit.isPending}
          onPress={() => void capture()}
        />

        <Button variant="ghost" label={t('common.cancel')} onPress={restart} />
      </Screen>
    );
  }

  const outcome = submit.data?.status ?? 'review';
  const reason = submit.data?.reason;

  return (
    <Screen scroll className="gap-6 py-6">
      <View className="gap-2">
        <View className="h-px w-12 bg-brand" />
        <Text variant="title">{t(`verify.result_${outcome}`)}</Text>
      </View>

      <Text tone="muted">{t(`verify.result_body_${outcome}`)}</Text>

      {/* A reason the machine gave, not a verdict. Shown so somebody who was
          simply in the dark can fix it and try again rather than guess. */}
      {outcome !== 'passed' && reason ? (
        <Card elevation="flat">
          <Text tone="muted">{t(`verify.reason_${reason}`, { defaultValue: '' })}</Text>
        </Card>
      ) : null}

      {outcome === 'passed' ? (
        <Button label={t('home.browse')} onPress={() => router.replace('/deck')} />
      ) : (
        <Button variant="secondary" label={t('verify.try_again')} onPress={restart} />
      )}

      <Button variant="ghost" label={t('common.back')} onPress={() => router.back()} />
    </Screen>
  );
}
