-- Written profile text had exactly one rule before this: a 500 character limit
-- on the bio. Nothing looked at what a display name, a bio or a prompt answer
-- actually said, which left the most common opening move in this category
-- unopposed: put a handle or a number in the bio and move the conversation
-- somewhere nobody can report it.
--
-- The same rules live in lib/text-safety.ts so the app can refuse the text
-- before it is sent. This is the copy that matters. A client is a suggestion.

create or replace function public.normalise_for_safety(input text, keep_spaces boolean)
returns text
language sql
immutable
as $$
  select case
    when keep_spaces then
      regexp_replace(
        btrim(regexp_replace(
          regexp_replace(translate(lower(input), '0134578@$!|', 'oieastbasii'),
                         '[^a-z0-9[:space:]]', ' ', 'g'),
          '[[:space:]]+', ' ', 'g')),
        '(.)\1+', '\1', 'g')
    else
      regexp_replace(
        regexp_replace(translate(lower(input), '0134578@$!|', 'oieastbasii'),
                       '[^a-z0-9]', '', 'g'),
        '(.)\1+', '\1', 'g')
  end
$$;

-- Deliberately short, and matched with word boundaries. Blocking a word that
-- merely contains one of these is a worse failure than missing a slur: it hits
-- somebody from Scunthorpe who did nothing.
create or replace function public.text_safety_violation(input text)
returns text
language plpgsql
immutable
as $$
declare
  spaced   text := public.normalise_for_safety(input, true);
  squashed text := public.normalise_for_safety(input, false);
  raw      text := lower(input);
  term     text;
  slurs    text[] := array[
    'nigger', 'nigga', 'faggot', 'tranny', 'retard',
    'kike', 'chink', 'spic', 'paki', 'coon'
  ];
begin
  if input is null or btrim(input) = '' then
    return null;
  end if;

  foreach term in array slurs loop
    if spaced ~ ('\y' || public.normalise_for_safety(term, true) || '\y') then
      return 'slur';
    end if;

    if length(term) >= 5
       and position(public.normalise_for_safety(term, false) in squashed) > 0 then
      return 'slur';
    end if;
  end loop;

  if raw ~ '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}'
     or raw ~ '(\+?[0-9][ -]?){9,}'
     or raw ~ '\y(wa\.?me|t\.?me|whatsapp|telegram|snapchat|snap ?chat|kik|discord)\y'
     or raw ~ '\y(insta(gram)?|ig|snap|tiktok)[[:space:]]*[:@-][[:space:]]*[a-z0-9._]{3,}'
     or raw ~ '(^|[[:space:]])@[a-z0-9._]{4,}([[:space:]]|$)'
     or spaced ~ '\y(whatsapp|telegram|snapchat|kik|discord)\y' then
    return 'contact';
  end if;

  if raw ~ '\y(onlyfans|only ?fans|cashapp|cash ?app|venmo|paypal|bitcoin|crypto)\y'
     or raw ~ '\y(my rates?|full service|incall|outcall|generous|sugar (daddy|baby|mommy))\y'
     or raw ~ '\y(escort|hookup for money|pay for my)\y'
     or spaced ~ '\y(onlyfans|venmo|paypal|bitcoin|crypto|escort)\y' then
    return 'solicitation';
  end if;

  return null;
end;
$$;

-- 22000 rather than a bespoke code: the client maps it to one message, and the
-- category travels in the message rather than in a second code to keep in sync.
create or replace function public.reject_unsafe_text()
returns trigger
language plpgsql
as $$
declare
  category text;
begin
  if tg_table_name = 'profiles' then
    category := public.text_safety_violation(new.display_name);

    if category is not null then
      raise exception 'unsafe_text:display_name:%', category using errcode = '22000';
    end if;

    category := public.text_safety_violation(new.bio);

    if category is not null then
      raise exception 'unsafe_text:bio:%', category using errcode = '22000';
    end if;
  elsif tg_table_name = 'profile_prompts' then
    category := public.text_safety_violation(new.answer);

    if category is not null then
      raise exception 'unsafe_text:answer:%', category using errcode = '22000';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_text_safety on public.profiles;

create trigger profiles_text_safety
  before insert or update of display_name, bio on public.profiles
  for each row
  execute function public.reject_unsafe_text();

drop trigger if exists profile_prompts_text_safety on public.profile_prompts;

create trigger profile_prompts_text_safety
  before insert or update of answer on public.profile_prompts
  for each row
  execute function public.reject_unsafe_text();
