export interface MapWithConcurrencyOptions {
  stopSchedulingOnError?: boolean;
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
  options: MapWithConcurrencyOptions = {},
): Promise<R[]> {
  if (items.length === 0) return [];

  const limit = Number.isFinite(concurrency)
    ? Math.max(1, Math.min(items.length, concurrency))
    : items.length;
  const results: R[] = new Array(items.length);
  const errors: unknown[] = [];
  let nextIndex = 0;

  const workers = Array.from({ length: limit }, async () => {
    while (nextIndex < items.length) {
      if (options.stopSchedulingOnError && errors.length > 0) {
        break;
      }

      const currentIndex = nextIndex++;
      try {
        results[currentIndex] = await mapper(items[currentIndex]);
      } catch (error) {
        errors.push(error);
        if (options.stopSchedulingOnError) {
          break;
        }
      }
    }
  });

  await Promise.all(workers);

  if (errors.length === 1) {
    throw errors[0];
  }

  if (errors.length > 1) {
    throw new AggregateError(errors, `${errors.length}개 작업이 실패했습니다.`);
  }

  return results;
}
