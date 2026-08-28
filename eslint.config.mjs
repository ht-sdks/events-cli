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
      'test/harness/python/',
      'test/harness/ruby/',
      'test/harness/php/',
      'test/harness/csharp/',
      'test/harness/android/',
      'test/harness/kotlin/',
      'test/harness/java/',
      'test/harness/react-native/generated.ts',
      'test/harness/flutter/',
    ],
  },
  ...tseslint.configs.recommended,
  prettier,
);
