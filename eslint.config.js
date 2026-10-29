const js = require("@eslint/js");
const globals = require("globals");
const importX = require("eslint-plugin-import-x");

module.exports = [
    js.configs.recommended,
    {
        files: ["pokemon/**/*.js"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: globals.browser,
        },
        plugins: { "import-x": importX },
        // Catch imports of names a module no longer exports, and paths that don't exist.
        rules: {
            "import-x/named": "error",
            "import-x/no-unresolved": "error",
            "import-x/no-cycle": "error",
        },
    },
    {
        files: ["tests/**/*.mjs"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: globals.node,
        },
    },
    {
        files: ["tests/**/*.js", "eslint.config.js"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "commonjs",
            globals: globals.node,
        },
    },
];
