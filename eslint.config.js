const tsParser = require("@typescript-eslint/parser");
const tsPlugin = require("@typescript-eslint/eslint-plugin");

module.exports = [
    {
        ignores: [
            "node_modules/**",
            "dist/**",
            "coverage/**",
            ".turbo/**",
            ".next/**",
            ".pnpm-debug.log",
            "**/*.log",
            "build/**",
            "out/**",
            ".vscode/**",
        ],
    },
    // Plain JS files — use default parser (avoid TS parser for config files)
    {
        files: ["**/*.js", "**/*.cjs", "**/*.mjs"],
        languageOptions: {
            ecmaVersion: 2020,
            sourceType: "module",
        },
        rules: {},
    },
    // TypeScript files — enable @typescript-eslint parser and plugin
    {
        files: ["**/*.ts", "**/*.tsx"],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                project: ["./tsconfig.json"],
                sourceType: "module",
                ecmaVersion: 2020,
            },
        },
        plugins: {
            "@typescript-eslint": tsPlugin,
        },
        rules: {
            ...(tsPlugin.configs &&
            tsPlugin.configs.recommended &&
            tsPlugin.configs.recommended.rules
                ? tsPlugin.configs.recommended.rules
                : {}),
        },
    },
];
