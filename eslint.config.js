import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

// Node <22 / some 20.x minors do not yet expose import.meta.dirname; emulate for CI reliability
const __dirname = dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        // Use resolved directory (avoid import.meta.dirname which may be undefined in some Node 20 runners)
        tsconfigRootDir: __dirname,
      },
    },
  },
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    rules: {
      // TypeScript specific rules
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/prefer-readonly': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      
      // General rules
      'no-console': 'off', // We use console for logging in server
      'no-debugger': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      'eqeqeq': ['error', 'always'],
      'curly': ['error', 'all'],
    },
  },
  {
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off', // Allow any in tests
      '@typescript-eslint/no-non-null-assertion': 'off', // Allow non-null assertion in tests
      '@typescript-eslint/no-unsafe-assignment': 'off', // Allow unsafe assignment in tests
      '@typescript-eslint/no-unsafe-member-access': 'off', // Allow unsafe member access in tests
      '@typescript-eslint/no-unsafe-call': 'off', // Allow unsafe calls in tests
      '@typescript-eslint/no-unsafe-argument': 'off', // Allow unsafe arguments in tests
      '@typescript-eslint/require-await': 'off', // Allow async functions without await in tests
      '@typescript-eslint/no-unused-vars': 'off', // Allow unused vars in tests
    },
  },
  {
    ignores: [
      'dist/',
      'node_modules/',
      '*.js',
      '*.d.ts',
      'coverage/',
      '.nyc_output/',
      'tsup.config.ts',
      'vitest.config.ts',
      'tests/**/fixtures/**/*.js', // Exclude test fixture JS files (integration tests)
    ],
  }
);
