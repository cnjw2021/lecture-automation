import { mapWithConcurrency } from './mapWithConcurrency';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('mapWithConcurrency', () => {
  it('waits for running workers before rejecting', async () => {
    let slowWorkerFinished = false;

    await expect(mapWithConcurrency(
      [1, 2],
      2,
      async item => {
        if (item === 1) {
          await delay(5);
          throw new Error('first failed');
        }

        await delay(20);
        slowWorkerFinished = true;
        return item;
      },
      { stopSchedulingOnError: true },
    )).rejects.toThrow('first failed');

    expect(slowWorkerFinished).toBe(true);
  });

  it('does not schedule extra work after a failure when stopSchedulingOnError is enabled', async () => {
    const started: number[] = [];

    await expect(mapWithConcurrency(
      [1, 2, 3],
      2,
      async item => {
        started.push(item);
        if (item === 1) {
          throw new Error('first failed');
        }

        await delay(10);
        return item;
      },
      { stopSchedulingOnError: true },
    )).rejects.toThrow('first failed');

    expect(started).toEqual([1, 2]);
  });
});
