module.exports = {
    "env": {
        "browser": true,
        "es6": true,
        "node": true
    },
    "parser": "@typescript-eslint/parser",
    "parserOptions": {
        "project": "tsconfig.json",
        "sourceType": "module"
    },
    "plugins": [
        "@typescript-eslint",
        "@typescript-eslint/tslint"
    ],
    "rules": {
        "@typescript-eslint/array-type": "error",
        "@typescript-eslint/class-name-casing": "error",
        "@typescript-eslint/consistent-type-definitions": "error",
        "@typescript-eslint/indent": "error",
        "@typescript-eslint/interface-name-prefix": "error",
        "@typescript-eslint/member-delimiter-style": [
            "error",
            {
                "multiline": {
                    "delimiter": "semi",
                    "requireLast": true
                },
                "singleline": {
                    "delimiter": "semi",
                    "requireLast": false
                }
            }
        ],
        "@typescript-eslint/prefer-namespace-keyword": "error",
        "@typescript-eslint/quotes": [
            "error",
            "single"
        ],
        "@typescript-eslint/semi": [
            "error",
            "always"
        ],
        "@typescript-eslint/type-annotation-spacing": "error",
        "comma-dangle": [
            "error",
            {
                "objects": "never",
                "arrays": "never",
                "functions": "never"
            }
        ],
        "curly": [
            "error",
            "multi-line"
        ],
        "eol-last": "error",
        "eqeqeq": [
            "error",
            "always"
        ],
        "new-parens": "error",
        "no-duplicate-imports": "error",
        "no-eval": "error",
        "no-restricted-imports": [
            "error",
            {
                "patterns": [
                    ".*\\/out\\/.*"
                ]
            }
        ],
        "no-trailing-spaces": "error",
        "no-unsafe-finally": "error",
        "no-var": "error",
        "one-var": [
            "error",
            "never"
        ],
        "prefer-const": "error",
        "spaced-comment": "error",
        "@typescript-eslint/tslint/config": [
            "error",
            {
                "rules": {
                    "naming-convention": [
                        true,
                        {
                            "type": "default",
                            "format": "camelCase",
                            "leadingUnderscore": "forbid"
                        },
                        {
                            "type": "type",
                            "format": "PascalCase"
                        },
                        {
                            "type": "class",
                            "format": "PascalCase"
                        },
                        {
                            "type": "property",
                            "modifiers": [
                                "const"
                            ],
                            "format": [
                                "camelCase",
                                "UPPER_CASE"
                            ]
                        },
                        {
                            "type": "member",
                            "modifiers": [
                                "protected"
                            ],
                            "format": "camelCase",
                            "leadingUnderscore": "require"
                        },
                        {
                            "type": "member",
                            "modifiers": [
                                "private"
                            ],
                            "format": "camelCase",
                            "leadingUnderscore": "require"
                        },
                        {
                            "type": "variable",
                            "modifiers": [
                                "const"
                            ],
                            "format": [
                                "camelCase",
                                "UPPER_CASE"
                            ]
                        },
                        {
                            "type": "variable",
                            "modifiers": [
                                "const",
                                "export"
                            ],
                            "filter": "^I.+Service$",
                            "format": "PascalCase",
                            "prefix": "I"
                        },
                        {
                            "type": "interface",
                            "prefix": "I"
                        }
                    ],
                    "no-else-after-return": [
                        true,
                        "allow-else-if"
                    ],
                    "prefer-const-enum": true,
                    "typedef": [
                        true,
                        "call-signature",
                        "parameter"
                    ],
                    "whitespace": [
                        true,
                        "check-branch",
                        "check-decl",
                        "check-module",
                        "check-operator",
                        "check-rest-spread",
                        "check-separator",
                        "check-type",
                        "check-type-operator",
                        "check-preblock"
                    ]
                }
            }
        ]
    }
};
