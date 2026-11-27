module.exports = {
    parser: '@typescript-eslint/parser',
    extends: ['plugin:@typescript-eslint/recommended', 'plugin:prettier/recommended', 'prettier'],
    parserOptions: {
        ecmaVersion: 2018,
        sourceType: 'module',
    },
    rules: {
        // '@typescript-eslint/indent': ['error', 4],      // use tab width 4
        '@typescript-eslint/indent': 'off',
        '@typescript-eslint/camelcase': 'off',
        '@typescript-eslint/no-use-before-define': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-var-requires': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
        //* v5 B16: lemon-model is reached only through lemon-core (root or `lemon-core/model`).
        'no-restricted-imports': [
            'error',
            {
                paths: [
                    {
                        name: 'lemon-model',
                        message: 'v5 B16: import from lemon-core (root) or lemon-core/model instead.',
                    },
                ],
                patterns: [
                    {
                        group: ['lemon-model/*'],
                    },
                    //* v5 B36: the `src/cores/` copy is removed; its names come from lemon-core (root).
                    {
                        group: [
                            './cores',
                            './cores/*',
                            '../cores',
                            '../cores/*',
                            '**/cores',
                            '**/cores/*',
                            '!lemon-core/**',
                        ], //* lemon-core's own deep paths stay allowed (HOW_TO § 3)
                        message: 'v5 B36: the cores copy is removed - import from lemon-core (root) instead.',
                    },
                ],
            },
        ],
    },
};
