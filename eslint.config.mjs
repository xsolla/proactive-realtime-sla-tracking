import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const ENGINE_MESSAGE =
  "src/engine is pure and cannot import framework or database modules.";

const RELATIVE_ESCAPE_MESSAGE =
  "Relative imports must not escape src/engine.";

const ALIAS_MESSAGE =
  "src/engine cannot import the rest of the app through the @/ alias.";

function restrictedImports(depth) {
  const relativeEscape =
    depth === 0
      ? String.raw`^\.\.(?:\/|$)`
      : `^(?:\\.\\.\\/){${depth + 1}}`;

  return {
    "no-restricted-imports": [
      "error",
      {
        paths: [
          { name: "react", message: ENGINE_MESSAGE },
          { name: "next", message: ENGINE_MESSAGE },
          { name: "drizzle-orm", message: ENGINE_MESSAGE },
          { name: "pg", message: ENGINE_MESSAGE },
        ],
        patterns: [
          {
            regex: "^(?:react|next|drizzle-orm|pg)\\/.+",
            message: ENGINE_MESSAGE,
            caseSensitive: true,
          },
          {
            regex: "^@/",
            message: ALIAS_MESSAGE,
            caseSensitive: true,
          },
          {
            regex: relativeEscape,
            message: RELATIVE_ESCAPE_MESSAGE,
            caseSensitive: true,
          },
        ],
      },
    ],
  };
}

const engineGlobs = [
  "src/engine/*.{js,jsx,ts,tsx,mjs,cjs}",
  "src/engine/*/*.{js,jsx,ts,tsx,mjs,cjs}",
  "src/engine/*/*/*.{js,jsx,ts,tsx,mjs,cjs}",
  "src/engine/*/*/*/*.{js,jsx,ts,tsx,mjs,cjs}",
  "src/engine/*/*/*/*/*.{js,jsx,ts,tsx,mjs,cjs}",
  "src/engine/*/*/*/*/*/*.{js,jsx,ts,tsx,mjs,cjs}",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  ...engineGlobs.map((files, depth) => ({
    files: [files],
    rules: restrictedImports(depth),
  })),
]);

export default eslintConfig;
