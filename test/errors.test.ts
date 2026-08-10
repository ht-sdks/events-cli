import { CliError, EXIT_FAILURE } from '../src/lib/errors';

it('CliError defaults to exit code 1', () => {
  expect(new CliError('boom').exitCode).toBe(EXIT_FAILURE);
});
