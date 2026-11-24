import { DrawQueue } from "../src/component/ui/DrawQueue";

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(r => (resolve = r));

  return { promise, resolve };
};

describe('DrawQueue', () => {
  it('runs one draw at a time', async () => {
    const queue = new DrawQueue();
    const first = deferred();
    let running = 0;
    let maxRunning = 0;

    const draw = (gate: Promise<void>) => async () => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await gate;
      running--;
    };

    const done = [queue.add(draw(first.promise), () => true), queue.add(draw(Promise.resolve()), () => true)];

    first.resolve();
    await Promise.all(done);

    expect(maxRunning).toBe(1);
  });

  it('draws the latest request first once the running one ends', async () => {
    const queue = new DrawQueue();
    const gate = deferred();
    const order: string[] = [];
    const done = [
      queue.add(async () => { order.push('a'); await gate.promise; }, () => true),
      queue.add(async () => { order.push('b'); }, () => true),
      queue.add(async () => { order.push('c'); }, () => true),
    ];

    gate.resolve();
    await Promise.all(done);

    expect(order).toEqual(['a', 'c', 'b']);
  });

  it('skips a draw nobody wants any more, and still settles it', async () => {
    const queue = new DrawQueue();
    const gate = deferred();
    const order: string[] = [];
    let wanted = true;
    const done = [
      queue.add(async () => { order.push('a'); await gate.promise; }, () => true),
      queue.add(async () => { order.push('b'); }, () => wanted),
    ];

    wanted = false;
    gate.resolve();
    await Promise.all(done);

    expect(order).toEqual(['a']);
  });

  it('keeps going after a draw fails, and rejects only that one', async () => {
    const queue = new DrawQueue();
    const failing = queue.add(async () => { throw new Error('broken pdf'); }, () => true);
    const next = queue.add(async () => undefined, () => true);

    await expect(failing).rejects.toThrow('broken pdf');
    await expect(next).resolves.toBeUndefined();
  });
});
