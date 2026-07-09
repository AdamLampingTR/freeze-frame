module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier",
  ],
  env: { node: true, es2022: true },
  ignorePatterns: ["dist", "node_modules"],
  rules: {
    // Stub service params are intentionally unused (leading underscore, same
    // convention tsc's noUnusedParameters already tolerates) — the agent fills
    // these in later. Without this override, @typescript-eslint/recommended
    // flags every stub param as an error.
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
  },
};
