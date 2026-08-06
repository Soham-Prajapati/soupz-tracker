import { clone } from './validation.js';

export const EMPTY_ENGINE_STATE = Object.freeze({ schemaVersion: 1, plans: {}, progress: {} });

export class MemoryRepository {
  constructor(initial = EMPTY_ENGINE_STATE) {
    this.state = clone(initial);
  }

  async read() {
    return clone(this.state);
  }

  async update(mutator) {
    const draft = clone(this.state);
    const result = await mutator(draft);
    this.state = draft;
    return clone(result);
  }
}
