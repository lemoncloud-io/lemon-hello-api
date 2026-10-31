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
                patterns: ['lemon-model/*'],
            },
        ],
    },
};
