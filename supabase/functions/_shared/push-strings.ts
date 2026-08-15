// Notification text, written by the server because the server is what decides
// what a push says. Every other string in the product is resolved on the device
// by i18next, and these cannot be, so push_tokens carries a locale and this is
// the table it selects from.
//
// Escaped rather than written literally: the repository is ASCII only and
// locales/*.json is the single exemption. Generated, never typed by hand.
//
// Deliberately says nothing about who wrote what, and never carries a word
// anybody typed. A notification sits on a lock screen in front of whoever is
// standing nearby, and "New message" is the version that does not out somebody
// for using a dating app. 0019 requires the same thing for a different reason.

export type PushKind = 'match' | 'message';

export type PushText = { title: string; body: string };

const STRINGS: Record<string, Record<PushKind, PushText>> = {
  en: {
    match: {
      title: 'It is a match',
      body: 'Someone you liked liked you back.',
    },
    message: {
      title: 'New message',
      body: 'Open OpenHeart to read it.',
    },
  },
  es: {
    match: {
      title: 'Hay match',
      body: 'Alguien que te gusto te ha correspondido.',
    },
    message: {
      title: 'Nuevo mensaje',
      body: 'Abre OpenHeart para leerlo.',
    },
  },
  fr: {
    match: {
      title: 'C\'est un match',
      body: 'Quelqu\'un que vous avez aime vous a aime en retour.',
    },
    message: {
      title: 'Nouveau message',
      body: 'Ouvrez OpenHeart pour le lire.',
    },
  },
  pt: {
    match: {
      title: 'Deu match',
      body: 'Alguem de quem voce gostou gostou de voce.',
    },
    message: {
      title: 'Nova mensagem',
      body: 'Abra o OpenHeart para ler.',
    },
  },
  id: {
    match: {
      title: 'Kalian cocok',
      body: 'Seseorang yang kamu suka juga menyukaimu.',
    },
    message: {
      title: 'Pesan baru',
      body: 'Buka OpenHeart untuk membacanya.',
    },
  },
  hi: {
    match: {
      title: '\u092e\u0948\u091a \u0939\u094b \u0917\u092f\u093e',
      body: 
        '\u091c\u093f\u0938\u0947 \u0906\u092a\u0928\u0947 \u092a\u0938\u0902\u0926 \u0915' +
        '\u093f\u092f\u093e, \u0909\u0938\u0928\u0947 \u092d\u0940 \u0906\u092a\u0915\u094b ' +
        '\u092a\u0938\u0902\u0926 \u0915\u093f\u092f\u093e\u0964',
    },
    message: {
      title: '\u0928\u092f\u093e \u0938\u0902\u0926\u0947\u0936',
      body: 
        '\u092a\u0922\u093c\u0928\u0947 \u0915\u0947 \u0932\u093f\u090f OpenHeart \u0916' +
        '\u094b\u0932\u0947\u0902\u0964',
    },
  },
  bn: {
    match: {
      title: '\u09ae\u09cd\u09af\u09be\u099a \u09b9\u09af\u09bc\u09c7\u099b\u09c7',
      body: 
        '\u0986\u09aa\u09a8\u09bf \u09af\u09be\u0995\u09c7 \u09aa\u099b\u09a8\u09cd\u09a6 ' +
        '\u0995\u09b0\u09c7\u099b\u09c7\u09a8, \u09a4\u09bf\u09a8\u09bf\u0993 \u0986\u09aa' +
        '\u09a8\u09be\u0995\u09c7 \u09aa\u099b\u09a8\u09cd\u09a6 \u0995\u09b0\u09c7\u099b' +
        '\u09c7\u09a8\u0964',
    },
    message: {
      title: '\u09a8\u09a4\u09c1\u09a8 \u09ac\u09be\u09b0\u09cd\u09a4\u09be',
      body: '\u09aa\u09a1\u09bc\u09a4\u09c7 OpenHeart \u0996\u09c1\u09b2\u09c1\u09a8\u0964',
    },
  },
  ar: {
    match: {
      title: '\u0644\u062f\u064a\u0643 \u062a\u0648\u0627\u0641\u0642',
      body: 
        '\u0634\u062e\u0635 \u0623\u0639\u062c\u0628\u0643 \u0623\u0639\u062c\u0628 \u0628' +
        '\u0643 \u0623\u064a\u0636\u0627.',
    },
    message: {
      title: '\u0631\u0633\u0627\u0644\u0629 \u062c\u062f\u064a\u062f\u0629',
      body: '\u0627\u0641\u062a\u062d OpenHeart \u0644\u0642\u0631\u0627\u0621\u062a\u0647\u0627.',
    },
  },
  ur: {
    match: {
      title: '\u0645\u06cc\u0686 \u06c1\u0648 \u06af\u06cc\u0627',
      body: 
        '\u062c\u0648 \u0622\u067e \u06a9\u0648 \u067e\u0633\u0646\u062f \u0622\u06cc\u0627' +
        '\u060c \u0627\u0633\u06d2 \u0628\u06be\u06cc \u0622\u067e \u067e\u0633\u0646\u062f ' +
        '\u0622\u0626\u06d2\u06d4',
    },
    message: {
      title: '\u0646\u06cc\u0627 \u067e\u06cc\u063a\u0627\u0645',
      body: 
        '\u067e\u0691\u06be\u0646\u06d2 \u06a9\u06d2 \u0644\u06cc\u06d2 OpenHeart \u06a9' +
        '\u06be\u0648\u0644\u06cc\u06ba\u06d4',
    },
  },
  'zh-Hans': {
    match: {
      title: '\u914d\u5bf9\u6210\u529f',
      body: '\u4f60\u559c\u6b22\u7684\u4eba\u4e5f\u559c\u6b22\u4f60\u3002',
    },
    message: {
      title: '\u65b0\u6d88\u606f',
      body: '\u6253\u5f00 OpenHeart \u67e5\u770b\u3002',
    },
  },
};

// A device reports something like en-GB or zh-Hans-CN. Try the whole tag, then
// the script-qualified form, then the bare language, and fall back to English
// rather than sending nothing at all.
export function pushText(locale: string | null, kind: PushKind): PushText {
  const tag = (locale ?? '').trim();
  const parts = tag.split('-');

  return (
    STRINGS[tag]?.[kind] ??
    STRINGS[parts.slice(0, 2).join('-')]?.[kind] ??
    STRINGS[parts[0]]?.[kind] ??
    STRINGS.en[kind]
  );
}
