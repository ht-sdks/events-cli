import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      'dist/',
      'coverage/',
      'node_modules/',
      '.tmp-render-*/',
      'test/harness/go/',
      'test/harness/browser-ts/generated.ts',
      'test/harness/node-ts/generated.ts',
      'test/harness/android/',
      'test/harness/kotlin/',
      'test/harness/java/',
    ],
  },
  ...tseslint.configs.recommended,
  prettier,
);
