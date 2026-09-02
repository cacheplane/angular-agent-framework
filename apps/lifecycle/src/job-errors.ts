export class DeterministicLifecycleJobError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeterministicLifecycleJobError';
  }
}
