import globals from "globals";
import babelParser from "@babel/eslint-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all,
});

export default [
    ...compat.extends("eslint:recommended"),
    {
        languageOptions: {
            globals: {
                ...globals.node,
            },
            parser: babelParser,
            parserOptions: {
                requireConfigFile: false,
                babelOptions: {
                    babelrc: false,
                    configFile: false,
                },
            },
        },
        rules: {
            "no-alert": "error",
            "no-array-constructor": "error",
            "no-caller": "error",
            "no-catch-shadow": "error",
            "no-eval": "error",
            "no-extend-native": "error",
            "no-extra-bind": "error",
            "no-implied-eval": "error",
            "no-iterator": "error",
            "no-label-var": "error",
            "no-labels": "error",
            "no-lone-blocks": "error",
            "no-loop-func": "error",
            "no-multi-str": "error",
            "no-native-reassign": "error",
            "no-new": "error",
            "no-new-func": "error",
            "no-new-object": "error",
            "no-new-wrappers": "error",
            "no-octal-escape": "error",
            "no-proto": "error",
            "no-return-assign": "error",
            "no-script-url": "error",
            "no-sequences": "error",
            "no-shadow": "error",
            "no-shadow-restricted-names": "error",
            "no-spaced-func": "error",
            "no-undef-init": "error",
            "no-unused-expressions": "error",
            "no-with": "error",
            camelcase: "error",
            "comma-spacing": "error",
            "consistent-return": "error",
            eqeqeq: "error",
            semi: "error",

            "semi-spacing": [
                "error",
                {
                    before: false,
                    after: true,
                },
            ],

            "space-infix-ops": "error",

            "space-unary-ops": [
                "error",
                {
                    words: true,
                    nonwords: false,
                },
            ],

            yoda: ["error", "never"],

            "brace-style": [
                "error",
                "stroustrup",
                {
                    allowSingleLine: false,
                },
            ],

            "eol-last": "error",

            indent: [
                "error",
                4,
                {
                    SwitchCase: 1,
                },
            ],

            "key-spacing": [
                "error",
                {
                    align: "value",
                },
            ],

            "max-nested-callbacks": ["error", 5],
            "new-parens": "error",
            "newline-after-var": ["error", "always"],
            "no-lonely-if": "error",

            "no-multiple-empty-lines": [
                "error",
                {
                    max: 2,
                },
            ],

            "no-nested-ternary": "error",
            "no-underscore-dangle": "off",
            "no-unneeded-ternary": "error",
            "object-curly-spacing": ["error", "always"],
            "operator-assignment": ["error", "always"],
            quotes: ["error", "single", "avoid-escape"],
            "keyword-spacing": "error",
            "space-before-blocks": ["error", "always"],
            "prefer-const": "error",
            "no-path-concat": "error",
            "no-undefined": "error",
            strict: "off",
            curly: ["error", "multi-or-nest"],
            "dot-notation": "off",
            "no-else-return": "error",
            "one-var": ["error", "never"],

            "no-multi-spaces": [
                "error",
                {
                    exceptions: {
                        VariableDeclarator: true,
                        AssignmentExpression: true,
                    },
                },
            ],

            radix: "error",
            "no-extra-parens": "error",

            "new-cap": [
                "error",
                {
                    capIsNew: false,
                },
            ],

            "space-before-function-paren": ["error", "always"],
            "no-use-before-define": ["error", "nofunc"],
            "handle-callback-err": "off",
            "require-atomic-updates": "off",
        },
    },
];