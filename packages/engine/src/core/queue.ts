interface Entry<T> {
  time: number;
  seq: number;
  event: T;
}

/** Min-heap of timed events. Events at the same time pop in the order they were pushed. */
export class EventQueue<T> {
  #heap: Entry<T>[] = [];
  #seq = 0;

  get size() {
    return this.#heap.length;
  }

  push(time: number, event: T) {
    this.#heap.push({ time, seq: this.#seq++, event });
    this.#up(this.#heap.length - 1);
  }

  pop(): { time: number; event: T } | undefined {
    const heap = this.#heap;
    const top = heap[0];
    const last = heap.pop();
    // Stryker disable next-line LogicalOperator: both are set exactly when the heap was non-empty
    if (!top || !last) return undefined;
    if (heap.length > 0) {
      heap[0] = last;
      this.#down(0);
    }
    return { time: top.time, event: top.event };
  }

  #less(a: number, b: number) {
    const x = this.#heap[a];
    const y = this.#heap[b];
    // Stryker disable next-line all: callers pass in-range indices; the guard only narrows types
    if (!x || !y) return false;
    // Stryker disable next-line EqualityOperator: seq is unique, so equal seqs never meet
    return x.time < y.time || (x.time === y.time && x.seq < y.seq);
  }

  #swap(a: number, b: number) {
    const heap = this.#heap;
    const x = heap[a];
    const y = heap[b];
    // Stryker disable next-line all: callers pass in-range indices; the guard only narrows types
    if (!x || !y) return;
    heap[a] = y;
    heap[b] = x;
  }

  #up(i: number) {
    // Stryker disable next-line EqualityOperator: at the root the parent index is out of range, so #less stops the loop
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.#less(i, parent)) return;
      this.#swap(i, parent);
      i = parent;
    }
  }

  #down(i: number) {
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let min = i;
      // Stryker disable next-line ConditionalExpression,EqualityOperator: #less is false for an out-of-range child
      if (l < this.#heap.length && this.#less(l, min)) min = l;
      // Stryker disable next-line ConditionalExpression,EqualityOperator: #less is false for an out-of-range child
      if (r < this.#heap.length && this.#less(r, min)) min = r;
      if (min === i) return;
      this.#swap(i, min);
      i = min;
    }
  }
}
