export const MINIMUM_AGE = 18;

// Mirrors the enforce_adult trigger. The database is the authority; this exists
// so the user is told before a write fails. The two can disagree by a day, since
// the trigger reads the server date in UTC and this reads the device's.
export function ageOn(birthdate: Date, today: Date): number {
  let age = today.getFullYear() - birthdate.getFullYear();
  const monthDelta = today.getMonth() - birthdate.getMonth();

  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthdate.getDate())) {
    age -= 1;
  }

  return age;
}

export function isAdult(birthdate: Date, today: Date = new Date()): boolean {
  return ageOn(birthdate, today) >= MINIMUM_AGE;
}

// Returns null rather than an invalid Date so a caller cannot send one to
// Postgres. Month is 1-based because that is what a person types.
export function toBirthdate(day: number, month: number, year: number): Date | null {
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) {
    return null;
  }

  const date = new Date(year, month - 1, day);

  // JavaScript rolls 31 February into March instead of rejecting it, so the only
  // reliable check is that the parts survived the round trip.
  const survived =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;

  return survived ? date : null;
}

// new Date('1995-03-04') parses as UTC midnight, which is the previous day west
// of Greenwich and makes the age a year wrong around the birthday. Nullable
// because 0018 clears the column on deletion.
export function fromDateColumn(value: string | null): Date | null {
  if (value === null) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  return toBirthdate(Number(match[3]), Number(match[2]), Number(match[1]));
}

// toISOString would convert to UTC first and can shift the day backwards.
export function toDateColumn(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${date.getFullYear()}-${month}-${day}`;
}
