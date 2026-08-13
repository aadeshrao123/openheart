# TypeScript and React Native Rules

---

## TypeScript

### `any` is banned

Use `unknown` and narrow it. If a third-party type is wrong, write a local
declaration file rather than casting through `any`.

```ts
// Bad
const payload = response.data as any;

// Good
const payload: unknown = response.data;
if (!isProfilePayload(payload)) {
  throw new Error('Unexpected profile payload shape');
}
```

### Never hand-write a database row type

Row types come from the generated file and nowhere else:

```bash
supabase gen types typescript --local > lib/database.types.ts
```

```ts
import type { Database } from '@/lib/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];
```

A hand-written type silently drifts from the schema. The generated one fails to
compile, which is the entire point.

### Prefer `type` over `interface`

Consistency beats the marginal differences. Use `interface` only when
declaration merging is genuinely needed, which is almost never.

### Export the props type of every component

```ts
export type ButtonProps = { ... };
export function Button(props: ButtonProps) { ... }
```

Consumers need it to wrap or extend the component.

### No default exports

Named exports only. They rename safely, autocomplete correctly, and stop two
files exporting "the default thing" under different names.

### Use the `@/` path alias

```ts
import { Button } from '@/components/ui';     // good
import { Button } from '../../components/ui'; // bad
```

---

## Components

### Two tiers, and they do not mix

- `components/ui/` holds primitives. They know nothing about dating, profiles,
  or matches. They would drop into any other app unchanged.
- `components/` holds feature components. They compose primitives and know the
  domain.

A primitive that imports from `@/hooks` or references a table name has crossed
the line and needs splitting.

### Nothing imports styled RN elements directly

Never import `Text`, or a `View`/`Pressable` that carries visual styling, from
`react-native` in a screen or feature component. Use the primitive from
`@/components/ui`. Layout-only `View` is fine.

If a primitive cannot express what you need, add a variant to the primitive.
That is how the design system grows. A one-off styled `Pressable` in a screen
is how it dies.

### Variants are lookup objects, not boolean props

Bad:

```ts
<Button isSecondary isSmall isDanger />
```

Good:

```ts
<Button variant="danger" size="sm" />
```

New looks are new keys in the `variants` map inside the component file. Boolean
props multiply combinatorially and most combinations are meaningless.

### Every primitive accepts `className` and merges with `cn()`

```ts
className={cn('rounded-control bg-brand', className)}
```

This lets callers adjust spacing without inventing a variant, and `twMerge`
makes the caller's class win deterministically.

### Extract on the second use, not the third

---

## Styling

### Colors, sizes, and radii are never literal

Banned in any component file: hex codes, `rgb()`, Tailwind palette names like
`pink-500`, and arbitrary values like `text-[17px]` or `p-[13px]`.

```tsx
<View className="bg-brand rounded-card p-4" />        // good
<View className="bg-[#E94A6E] rounded-[20px]" />      // bad
```

All values live in `global.css`. All names live in `tailwind.config.js`. A
restyle of the whole product is a one-file diff, and that property is only
preserved if this rule holds without exception.

### Token names describe purpose, not appearance

`--brand`, never `--pink`. `--danger`, never `--red`. `--fg-muted`, never
`--gray-600`. Naming a token after its current color just relocates the problem
to rebrand day.

### No `StyleSheet.create`, no inline `style` objects

NativeWind `className` only. The single exception is a value that must be
computed at runtime, such as an animated transform.

---

## Data

### Server state is TanStack Query, always

Never `useEffect` plus `useState` around a Supabase call. That pattern
re-fetches on every mount, races on unmount, and has no cache.

### Supabase calls live in `hooks/`, never in a component

A screen calls a hook. If a screen contains `supabase.from(...)`, it is
misplaced.

### Zustand holds UI state only

Filter panel open, current deck index, draft message text. It never mirrors
server data. Two sources of truth for the same row is a bug that shows up as
stale UI weeks later.

### Throw errors, do not swallow them

```ts
const { data, error } = await supabase.rpc('discover_profiles');
if (error) {
  throw error;
}
return data;
```

TanStack Query and the error boundary handle presentation. A swallowed error is
an empty screen with no explanation.

---

## Cross-platform

Every screen works on iOS, Android, and web. A change that works on one is not
finished.

Platform differences go in `.ios.tsx` / `.android.tsx` / `.web.tsx` files, not
`Platform.OS` branches scattered through a component body. One branch for a
single style value is acceptable; a component with four of them needs splitting.

---

## Accessibility

Not optional polish. Every interactive element needs:

- `accessibilityRole`
- an accessible label, either visible text or `accessibilityLabel`
- `accessibilityState` when it can be disabled, busy, selected, or checked

Touch targets are at least 44x44 points. Never convey meaning through color
alone: the like and pass actions need icons or text, not just green and grey.
