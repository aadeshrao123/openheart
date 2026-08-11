// Separate from format.ts so it can be unit tested: format.ts imports
// expo-localization, which pulls in react-native and cannot load under vitest.

// Whole calendar days between two instants, in local time. Not a subtraction:
// 22:00 and 01:00 are three hours apart and belong to different days, which is
// the only thing a reader cares about.
export function calendarDayOffset(date: Date, now: Date): number {
  const startOfDay = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();

  return Math.round((startOfDay(date) - startOfDay(now)) / (1000 * 60 * 60 * 24));
}
