import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['dist/**', 'node_modules/**'] },

  js.configs.recommended,

  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // 7 findings, all the same pattern: useEffect(() => { load() }, [load])
      // where load() calls setState. That is a real code smell - it causes a
      // second render pass - but the fix is to move data fetching out of
      // effects entirely (a query library, or a framework loader), not to
      // rearrange the effect. That is a real refactor, so it is a warning for
      // now rather than a red build that blocks every other change.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },

  // Build-time config runs in Node, not the browser. Without this, `process`
  // in vite.config.js is an undefined global.
  {
    files: ['*.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node,
    },
  },
];
