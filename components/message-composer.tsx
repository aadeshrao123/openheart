import { ComposerShell, type MessageComposerProps } from '@/components/message-composer-shell';

export type { MessageComposerProps };

// Enter inserts a newline and only the send button sends. submitBehavior is
// what says so in react-native 0.86, where blurOnSubmit still exists but its
// own type calls it deprecated: "submitBehavior now takes the place of
// blurOnSubmit and will override any behavior defined by blurOnSubmit."
// "newline" is already the multiline default; it is written out because the
// web file deliberately does the opposite.
export function MessageComposer(props: MessageComposerProps) {
  return <ComposerShell {...props} fieldProps={() => ({ submitBehavior: 'newline' })} />;
}
