export const EXIT_FAILURE = 1;
/** Reserved for `check` reporting drift between contracts and generated code. */
export const EXIT_DRIFT = 2;

/** An expected failure: printed as a friendly message, no stack trace. */
export class CliError extends Error {
  constructor(
    message: string,
    readonly exitCode: number = EXIT_FAILURE,
  ) {
    super(message);
    this.name = 'CliError';
  }
}
