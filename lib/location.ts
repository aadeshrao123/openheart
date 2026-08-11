// Two decimal places is roughly 1km, and matches the round_location trigger.
const PRECISION = 2;

function coarsen(value: number): number {
  const factor = 10 ** PRECISION;

  return Math.round(value * factor) / factor;
}

// The trigger rounds again, so this is not what makes the stored value coarse.
// It is what stops the precise coordinate leaving the device at all, where it
// would otherwise pass through a request log on the way to Postgres.
//
// PostGIS wants longitude first, which is the reverse of every location API.
export function toCoarseLocation(latitude: number, longitude: number): string {
  return `SRID=4326;POINT(${coarsen(longitude)} ${coarsen(latitude)})`;
}
