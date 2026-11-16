import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  // server/ tiene su propio eslint.config.mjs; dist y coverage son archivos generados
  globalIgnores(["server/**", "**/dist/**", "**/coverage/**", "playwright-report/**", "test-results/**"]),
  { files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"], plugins: { js }, extends: ["js/recommended"], languageOptions: { globals: globals.browser } },
  tseslint.configs.recommended,
  pluginReact.configs.flat.recommended,
  pluginReact.configs.flat["jsx-runtime"], // desactiva react-in-jsx-scope (React 17+)
  { settings: { react: { version: "detect" } } },
]);
