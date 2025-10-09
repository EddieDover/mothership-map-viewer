import js from "@eslint/js";
import prettier from "eslint-plugin-prettier/recommended";
import globals from "globals";

export default [
  js.configs.recommended,
  prettier,
  {
    files: ["src/**/*.{js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        // Foundry VTT globals
        game: "readonly",
        ui: "readonly",
        canvas: "readonly",
        CONFIG: "readonly",
        Hooks: "readonly",
        Actor: "readonly",
        ActorSheet: "readonly",
        ChatMessage: "readonly",
        Dialog: "readonly",
        Roll: "readonly",
        RollTable: "readonly",
        foundry: "readonly",
      },
    },
    rules: {
      "no-multiple-empty-lines": ["error", { max: 1, maxEOF: 0, maxBOF: 0 }],
      "linebreak-style": ["off"],
    },
  },
  {
    ignores: ["node_modules/**", "dist/**"],
  },
];
