export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];

  const limit = Number.isFinite(concurrency)
    ? Math.max(1, Math.min(items.length, concurrency))
    : items.length;
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const workers = Array.from({ length: limit }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  });

  await Promise.all(workers);
  return results;
}
