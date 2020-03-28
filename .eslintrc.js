module.exports = {
    "env": {
        "browser": true,
        "es6": true,
        "node": true
    },
    "parser": "@typescript-eslint/parser",
    "parserOptions": {
        "project": [
          "src/browser/tsconfig.json",
          "src/common/tsconfig.json",
          "src/tsconfig.json",
          "test/api/tsconfig.json",
          "test/benchmark/tsconfig.json",
          "addons/xterm-addon-attach/src/tsconfig.json",
          "addons/xterm-addon-fit/src/tsconfig.json",
          "addons/xterm-addon-search/src/tsconfig.json",
          "addons/xterm-addon-unicode11/src/tsconfig.json",
          "addons/xterm-addon-web-links/src/tsconfig.json",
          "addons/xterm-addon-webgl/src/tsconfig.json",
          "addons/xterm-addon-serialize/src/tsconfig.json",
          "addons/xterm-addon-serialize/benchmark/tsconfig.json"
        ],
        "sourceType": "module"
    },
    "ignorePatterns": "**/typings/*.d.ts",
    "plugins": [
        "@typescript-eslint",
        "@typescript-eslint/tslint"
    ],
    "rules": {
        "@typescript-eslint/array-type": [
          "error",
          {
            "default": "array-simple",
            "readonly": "generic"
          }
        ],
        "@typescript-eslint/class-name-casing": "error",
        "@typescript-eslint/consistent-type-definitions": "error",
        "@typescript-eslint/indent": [
          "error",
          2
        ],
        "@typescript-eslint/interface-name-prefix": [
          "error",
          "always"
        ],
        "@typescript-eslint/member-delimiter-style": [
            "error",
            {
                "multiline": {
                    "delimiter": "semi",
                    "requireLast": true
                },
                "singleline": {
                    "delimiter": "comma",
                    "requireLast": false
                }
            }
        ],
        "@typescript-eslint/prefer-namespace-keyword": "error",
        "@typescript-eslint/quotes": [
            "error",
            "single",
            { "allowTemplateLiterals": true }
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
        "no-else-return": [
          "error",
          {
            allowElseIf: false
          }
        ],
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
        "spaced-comment": [
          "error",
          "always",
          {
            "markers": ["/"],
            "exceptions": ["-"]
          }
        ],
        "@typescript-eslint/tslint/config": [
            "error",
            {
                "rules": {
                    // "naming-convention": [
                    //     true,
                    //     {
                    //         "type": "default",
                    //         "format": "camelCase",
                    //         "leadingUnderscore": "forbid"
                    //     },
                    //     {
                    //         "type": "type",
                    //         "format": "PascalCase"
                    //     },
                    //     {
                    //         "type": "class",
                    //         "format": "PascalCase"
                    //     },
                    //     {
                    //         "type": "property",
                    //         "modifiers": [
                    //             "const"
                    //         ],
                    //         "format": [
                    //             "camelCase",
                    //             "UPPER_CASE"
                    //         ]
                    //     },
                    //     {
                    //         "type": "member",
                    //         "modifiers": [
                    //             "protected"
                    //         ],
                    //         "format": "camelCase",
                    //         "leadingUnderscore": "require"
                    //     },
                    //     {
                    //         "type": "member",
                    //         "modifiers": [
                    //             "private"
                    //         ],
                    //         "format": "camelCase",
                    //         "leadingUnderscore": "require"
                    //     },
                    //     {
                    //         "type": "variable",
                    //         "modifiers": [
                    //             "const"
                    //         ],
                    //         "format": [
                    //             "camelCase",
                    //             "UPPER_CASE"
                    //         ]
                    //     },
                    //     {
                    //         "type": "variable",
                    //         "modifiers": [
                    //             "const",
                    //             "export"
                    //         ],
                    //         "filter": "^I.+Service$",
                    //         "format": "PascalCase",
                    //         "prefix": "I"
                    //     },
                    //     {
                    //         "type": "interface",
                    //         "prefix": "I"
                    //     }
                    // ],
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
