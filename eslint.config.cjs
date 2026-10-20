const frontendRequire = require("node:module").createRequire(
  require("node:path").resolve(__dirname, "frontend/package.json"),
);
const ts = frontendRequire("typescript-eslint");
const angular = frontendRequire("angular-eslint");
const rules = {
  "no-debugger": "error",
  "no-dupe-keys": "error",
  "no-unreachable": "error",
  "no-unsafe-finally": "error",
  "valid-typeof": "error",
  "no-sparse-arrays": "error",
};
module.exports = [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/coverage/**",
      ".cache/**",
      "data/**",
      "logs/**",
      "API CA/**",
    ],
  },
  {
    files: [
      "backend/**/*.js",
      "scripts/**/*.{js,cjs,mjs}",
      "tests/**/*.cjs",
      "frontend/tools/**/*.cjs",
      "eslint.config.cjs",
    ],
    languageOptions: { ecmaVersion: "latest", sourceType: "commonjs" },
    rules,
  },
  { files: ["scripts/**/*.mjs"], languageOptions: { sourceType: "module" } },
  {
    files: ["frontend/src/**/*.ts"],
    languageOptions: { parser: ts.parser },
    rules,
  },
  {
    files: ["frontend/src/**/*.html"],
    languageOptions: { parser: angular.templateParser },
    plugins: { "@angular-eslint/template": angular.templatePlugin },
    rules: { "@angular-eslint/template/banana-in-box": "error" },
  },
];
