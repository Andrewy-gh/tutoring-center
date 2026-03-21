// Some legacy join helpers return an object, an array, or null for the same logical shape.
// These helpers normalize that into a single object (or null).

// If it's an array, return the first item. If it's an object, return it.
// If it's null/undefined or an empty array, return null.
export function pickFirstEmbedded<T>(embedded: T | T[] | null | undefined): T | null {
  if (embedded === null || embedded === undefined) return null;
  if (Array.isArray(embedded)) return embedded[0] ?? null;
  return embedded;
}

// Same as pickFirstEmbedded, but skips null/undefined items inside arrays.
// Handy if you ever see something like [null].
export function pickFirstNonNullEmbedded<T>(embedded: T | T[] | null | undefined): T | null {
  if (embedded === null || embedded === undefined) return null;
  if (!Array.isArray(embedded)) return embedded;

  for (const item of embedded) {
    if (item !== null && item !== undefined) return item;
  }

  return null;
}
