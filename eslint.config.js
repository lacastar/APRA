module.exports = [
  {
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2022,

      },
    },
    files: ["test/**/*.js", "scripts/**/*.js"],
    rules: {
      'no-console': 'off',
      'no-plusplus': 'off',
      'max-len': 'off',
      'no-param-reassign': ['error', { props: false }],
      'no-underscore-dangle': 'off',
      'prefer-destructuring': ['error', {
        VariableDeclarator: {
          array: true,
          object: true,
        },
        AssignmentExpression: {
          array: false,
          object: false,
        },
      }, {
          enforceForRenamedProperties: false,
        }],
    },

  }
];