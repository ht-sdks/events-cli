import { join } from 'path';
import {
  loadConfig,
  requireTokenIfApi,
  resolveToken,
} from '../src/config/load';
import { CliError } from '../src/lib/errors';

const fixtures = join(__dirname, 'fixtures', 'config');

describe('loadConfig', () => {
  it('loads a valid api config', () => {
    const config = loadConfig(join(fixtures, 'valid-api.json'));
    expect(config.source).toBe('web-app');
    expect(config.input).toEqual({ type: 'api' });
  });

  it('loads a valid git-sync config', () => {
    const config = loadConfig(join(fixtures, 'valid-git-sync.json'));
    expect(config.input).toEqual({ type: 'git-sync', path: './events' });
  });

  it('rejects unknown sdk with a path-level message', () => {
    expect(() => loadConfig(join(fixtures, 'invalid-sdk.json'))).toThrow(
      /outputs\.0\.sdk/,
    );
  });

  it('rejects token in the config file', () => {
    expect(() => loadConfig(join(fixtures, 'with-token.json'))).toThrow(
      /must not contain "token"/,
    );
  });

  it('rejects missing files', () => {
    expect(() => loadConfig(join(fixtures, 'nope.json'))).toThrow(/not found/i);
  });

  it('rejects malformed JSON', () => {
    expect(() => loadConfig(join(fixtures, 'malformed.json'))).toThrow(
      /not valid JSON/,
    );
  });
});

describe('resolveToken', () => {
  const original = process.env.HIGHTOUCH_API_TOKEN;

  afterEach(() => {
    if (original === undefined) delete process.env.HIGHTOUCH_API_TOKEN;
    else process.env.HIGHTOUCH_API_TOKEN = original;
  });

  it('prefers the flag over the env var', () => {
    process.env.HIGHTOUCH_API_TOKEN = 'from-env';
    expect(resolveToken('from-flag')).toBe('from-flag');
  });

  it('falls back to the env var', () => {
    process.env.HIGHTOUCH_API_TOKEN = 'from-env';
    expect(resolveToken(undefined)).toBe('from-env');
  });
});

describe('requireTokenIfApi', () => {
  const apiConfig = loadConfig(join(fixtures, 'valid-api.json'));
  const gitConfig = loadConfig(join(fixtures, 'valid-git-sync.json'));

  it('requires a token for api input', () => {
    delete process.env.HIGHTOUCH_API_TOKEN;
    expect(() => requireTokenIfApi(apiConfig)).toThrow(CliError);
  });

  it('does not require a token for git-sync', () => {
    delete process.env.HIGHTOUCH_API_TOKEN;
    expect(requireTokenIfApi(gitConfig)).toBeUndefined();
  });
});
