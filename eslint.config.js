// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // Règle pensée pour le HTML : les apostrophes dans un <Text> React Native ne posent aucun problème.
    rules: { 'react/no-unescaped-entities': 'off' },
  },
]);
