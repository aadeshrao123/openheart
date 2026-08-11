import { ComposerShell, type MessageComposerProps } from '@/components/message-composer-shell';

export type { MessageComposerProps };

// react-native-web calls onKeyPress from its own onKeyDown and hands it the DOM
// keyboard event, which react-native types as { key: string } and nothing else,
// so it arrives here as unknown and is narrowed. Its handler reads:
//   if (onKeyPress) { onKeyPress(e); }
//   if (e.key === 'Enter' && !e.shiftKey && !isComposing && !e.isDefaultPrevented())
// which is why preventDefault does two jobs: it stops the newline, and it stops
// react-native-web running its own submit path afterwards.
type WebKeyEvent = {
  key: string;
  shiftKey: boolean;
  nativeEvent?: { isComposing?: boolean; keyCode?: number };
  preventDefault: () => void;
};

function isWebKeyEvent(event: unknown): event is WebKeyEvent {
  if (typeof event !== 'object' || event === null) {
    return false;
  }

  return 'key' in event && 'shiftKey' in event && 'preventDefault' in event;
}

// An input method editor sends Enter to accept the candidate word it is
// showing, so sending on that would eat the first word of every message in
// Japanese or Chinese. react-native-web guards its own submit the same way.
function isComposing(event: WebKeyEvent) {
  return event.nativeEvent?.isComposing === true || event.nativeEvent?.keyCode === 229;
}

// A textarea does not grow with its content the way a native multiline
// TextInput does, and react-native-web leaves the rows attribute unset, so the
// browser's default of two would apply forever. It reads numberOfLines when
// rows is absent, so the lines in the draft set the height instead. A wrapped
// line is not one of them and scrolls, which is what the cap does on native
// past three lines anyway.
const MAX_LINES = 3;

export function MessageComposer(props: MessageComposerProps) {
  return (
    <ComposerShell
      {...props}
      fieldProps={({ draft, send }) => ({
        numberOfLines: Math.min(MAX_LINES, draft.split('\n').length),
        enterKeyHint: 'send',
        onKeyPress: (event: unknown) => {
          if (!isWebKeyEvent(event) || event.key !== 'Enter' || event.shiftKey) {
            return;
          }

          if (isComposing(event)) {
            return;
          }

          event.preventDefault();
          send();
        },
      })}
    />
  );
}
