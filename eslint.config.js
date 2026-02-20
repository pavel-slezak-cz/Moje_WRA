import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ["**/*.ts"],
        languageOptions: {
            parserOptions: {
                project: "./tsconfig.json",
            },
        },
    },
    {
        ignores: ["node_modules", "dist", "src/generated", "prisma.config.ts"],
    },
];
