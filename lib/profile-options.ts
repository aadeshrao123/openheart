import { KM_PER_MILE } from '@/lib/format';

// The values written to profiles.gender and profiles.seeking. Both columns are
// free text in the schema, so this list is the only thing keeping them to a
// known set, and Phase 4 matching joins seeking against gender using exactly
// these strings.
//
// Stored values are stable identifiers and never shown to anyone. The label is
// always looked up through i18n, so translating one cannot change what is in
// the database.
export const GENDERS = ['woman', 'man', 'nonbinary'] as const;

export type Gender = (typeof GENDERS)[number];

export function isGender(value: string): value is Gender {
  return (GENDERS as readonly string[]).includes(value);
}

// Mirrors the CHECK constraints in 0001_init.sql. Keeping the client in step
// means a user is told what is wrong while they type instead of getting a
// constraint violation back from Postgres.
export const DISPLAY_NAME_MAX = 40;
export const BIO_MAX = 500;

export const AGE_FLOOR = 18;
export const AGE_CEILING = 120;

export const DISTANCE_MIN_KM = 1;
export const DISTANCE_MAX_KM = 500;

// Presets rather than a slider, which takes its colours as JavaScript props and
// would put a colour outside global.css.
//
// Two lists because the column stores kilometres but the label is rendered in
// the reader's unit: round kilometres come out as 3, 6, 16, 31 miles, which
// reads like a rounding bug rather than a set of choices.
// The slider stores kilometres and renders the reader's unit, so an imperial
// reader steps a whole mile at a time. Without this they drag to 25 km and read
// 16 mi, which looks like the control is broken.
export const KM_PER_MILE_STEP = KM_PER_MILE;

export function defaultDistanceKm(imperial: boolean): number {
  return imperial ? Math.round(25 * KM_PER_MILE) : 25;
}

// Every list below mirrors a CHECK constraint in 0021. A value that is not
// here is refused by Postgres, so the two must not drift.

export const RELATIONSHIP_INTENTS = [
  'long_term',
  'long_term_open_short',
  'short_term_open_long',
  'short_term',
  'friends',
  'figuring_out',
] as const;

export const LIFESTYLE_FREQUENCIES = ['never', 'sometimes', 'often', 'prefer_not_say'] as const;

export const CHILDREN_OPTIONS = [
  'have_and_want_more',
  'have_and_done',
  'want_someday',
  'do_not_want',
  'not_sure',
] as const;

export const EDUCATION_LEVELS = [
  'secondary',
  'vocational',
  'undergraduate',
  'postgraduate',
  'doctorate',
] as const;

// The lifestyle columns share one shape, so the screens iterate this rather
// than repeating three near-identical blocks. Keys are written out so the
// translation key test can see them.
export const LIFESTYLE_FIELDS = [
  { field: 'drinking', label: 'profile.drinking', summary: 'profile.drinking_summary' },
  { field: 'smoking', label: 'profile.smoking', summary: 'profile.smoking_summary' },
  { field: 'exercise', label: 'profile.exercise', summary: 'profile.exercise_summary' },
] as const;

export type RelationshipIntent = (typeof RELATIONSHIP_INTENTS)[number];
export type LifestyleFrequency = (typeof LIFESTYLE_FREQUENCIES)[number];
export type ChildrenOption = (typeof CHILDREN_OPTIONS)[number];
export type EducationLevel = (typeof EDUCATION_LEVELS)[number];
export type LifestyleField = (typeof LIFESTYLE_FIELDS)[number]['field'];

// Grouped for the picker screen. Forty-four in one flat wrap is a wall; the
// same forty-four under six headings is a list somebody can scan.
export const INTEREST_GROUPS = [
  {
    key: 'outdoors',
    interests: ['camping', 'climbing', 'cycling', 'fishing', 'hiking', 'sea_swimming', 'skiing'],
  },
  {
    key: 'active',
    interests: ['dancing', 'football', 'gym', 'running', 'skating', 'swimming', 'yoga'],
  },
  {
    key: 'creative',
    interests: ['art', 'diy', 'gardening', 'music_making', 'photography', 'writing'],
  },
  {
    key: 'going_out',
    interests: ['concerts', 'gigs', 'live_comedy', 'markets', 'museums', 'theatre', 'travel'],
  },
  {
    key: 'staying_in',
    interests: ['baking', 'board_games', 'books', 'cooking', 'film', 'gaming', 'podcasts'],
  },
  {
    key: 'other',
    interests: [
      'cats',
      'coffee',
      'dogs',
      'languages',
      'meditation',
      'motorbikes',
      'politics',
      'stargazing',
      'tea',
      'volunteering',
    ],
  },
] as const;

export const INTERESTS = [
  'art',
  'baking',
  'board_games',
  'books',
  'camping',
  'climbing',
  'coffee',
  'concerts',
  'cooking',
  'cycling',
  'dancing',
  'diy',
  'dogs',
  'cats',
  'film',
  'fishing',
  'football',
  'gaming',
  'gardening',
  'gigs',
  'gym',
  'hiking',
  'languages',
  'live_comedy',
  'markets',
  'meditation',
  'motorbikes',
  'museums',
  'music_making',
  'photography',
  'podcasts',
  'politics',
  'running',
  'sea_swimming',
  'skating',
  'skiing',
  'stargazing',
  'swimming',
  'tea',
  'theatre',
  'travel',
  'volunteering',
  'writing',
  'yoga',
] as const;

export type Interest = (typeof INTERESTS)[number];

export const INTERESTS_MAX = 8;

// Questions somebody answers on their profile, grouped the way the picker
// shows them. Stable keys; the question text is a translation, so rewording
// one never rewrites what people already wrote.
//
// Hinge ships 85 across eight categories and Bumble around 40, both letting
// you answer three. Fifty-four sits between them, and a picker that opens on
// its own screen can carry that many without being a wall.
export const PROMPT_GROUPS = [
  {
    key: 'about_me',
    prompts: [
      'two_truths',
      'bad_at',
      'weirdly_good_at',
      'people_misjudge',
      'small_joy',
      'proud_of',
      'spend_too_much_on',
      'nobody_believes',
      'my_friends_say',
    ],
  },
  {
    key: 'story_time',
    prompts: [
      'best_meal',
      'never_again',
      'worst_idea',
      'biggest_risk',
      'furthest_travelled',
      'changed_my_mind',
      'best_advice',
      'unreasonably_proud',
      'last_time_lost',
    ],
  },
  {
    key: 'my_type',
    prompts: [
      'looking_for',
      'green_flag',
      'make_me_laugh',
      'together_we_could',
      'we_will_get_on_if',
      'deal_breaker',
      'first_impression',
      'i_appreciate_when',
      'love_language',
    ],
  },
  {
    key: 'self_care',
    prompts: [
      'happy_place',
      'wind_down',
      'boundary',
      'feel_supported',
      'friends_ask_advice',
      'out_of_a_funk',
      'recharge_by',
      'kind_to_myself',
      'song_in_the_car',
    ],
  },
  {
    key: 'date_vibes',
    prompts: [
      'weekend_plan',
      'sunday',
      'order_for_the_table',
      'take_you_here',
      'ideal_saturday',
      'best_local_spot',
      'travel_with_me',
      'cook_you',
      'first_round',
    ],
  },
  {
    key: 'lets_chat',
    prompts: [
      'convince_me',
      'irrational_fear',
      'unpopular_opinion',
      'overrated',
      'underrated',
      'hill_i_die_on',
      'teach_me',
      'obsessed_with',
      'debate_me',
    ],
  },
] as const;

export const PROMPTS = PROMPT_GROUPS.flatMap((group) => group.prompts);

export type Prompt = (typeof PROMPTS)[number];
export type PromptGroup = (typeof PROMPT_GROUPS)[number]['key'];

export const PROMPTS_MAX = 3;
export const PROMPT_ANSWER_MAX = 255;
export const JOB_TITLE_MAX = 60;

export const HEIGHT_MIN_CM = 120;
export const HEIGHT_MAX_CM = 250;
export const LANGUAGES_MAX = 6;
