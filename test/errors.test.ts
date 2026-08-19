import { CliError, EXIT_DRIFT, EXIT_FAILURE } from '../src/lib/errors';

it('CliError defaults to exit code 1', () => {
  expect(new CliError('boom').exitCode).toBe(EXIT_FAILURE);
});

it('CliError can report drift as exit code 2', () => {
  expect(new CliError('stale', EXIT_DRIFT).exitCode).toBe(2);
});
