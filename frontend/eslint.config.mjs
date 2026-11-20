import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // eslint-config-next registers the jsx-a11y plugin with a handful of rules; turn on the full strict set.
  { rules: { ...jsxA11y.flatConfigs.strict.rules } },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "jsx-a11y/aria-role": ["error", { ignoreNonDOM: true }],
      "@typescript-eslint/ban-ts-comment": ["error", { "ts-expect-error": "allow-with-description", minimumDescriptionLength: 10 }],
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXAttribute[name.name='style'] > JSXExpressionContainer > ObjectExpression > Property[value.type='Literal'][value.value=/^[0-9]/]",
          message: "No literal numeric inline styles; use a token (CSS variable) instead.",
        },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "coverage/**", "playwright-report/**", "test-results/**", "next-env.d.ts", "src/lib/api/schema.d.ts", "scripts/**"]),
]);
