import js from '@eslint/js';
import globals from 'globals';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  // Base JavaScript config
  js.configs.recommended,
  
  // TypeScript source files configuration (with project)
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json',
      },
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      // TypeScript specific rules
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/no-var-requires': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      
      // General rules
      'no-console': 'off', // Allow console for logging utilities
      'no-unused-vars': 'off', // Let TypeScript handle this
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-template': 'error',
    },
  },
  
  // Test files configuration
  {
    files: ['tests/**/*.ts', '**/*.test.ts', '**/*.spec.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        // Don't use project for test files since they're excluded from tsconfig
      },
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off', // Allow any in tests
      '@typescript-eslint/no-unused-vars': 'off', // Allow unused vars in tests
      'no-unused-vars': 'off', // Allow unused vars in tests
      'no-console': 'off',
    },
  },
  
  // JavaScript files configuration
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
  },
  
  // Config files configuration (vitest.config.ts, etc.)
  {
    files: ['*.config.ts', '*.config.js'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },
  
  // Example files configuration
  {
    files: ['examples/**/*.js'],
    rules: {
      'no-console': 'off', // Allow console in examples
      'no-unused-vars': 'off', // Allow unused vars in examples for demo purposes
    },
  },
  
  // Ignore patterns
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      '*.d.ts',
    ],
  },
];
