module.exports = {
  extends: [],
  parserPreset: {
    parserOpts: {
      headerPattern: /^(\w+)(\(\[(.+)\]\)|\[(.+)\]): (.+)$/,
      headerCorrespondence: [
        "type",
        "scopeWrapper",
        "scopeParens",
        "scopeBrackets",
        "subject",
      ],
    },
  },

  plugins: [
    {
      rules: {
        "custom-scope-required": (parsed) => {
          const { header } = parsed;
          const match = header.match(
            /^(\w+)(\(\[(.+)\]\)|\[(.+)\]): (.+)$/
          );
          if (!match) {
            return [
              false,
              "Commit message must follow pattern: type[scope]: description or type([scope]): description",
            ];
          }
          const scope = match[3] || match[4];
          if (!scope || scope.trim() === "") {
            return [false, "Scope is required and cannot be empty"];
          }
          return [true];
        },
      },
    },
  ],
  rules: {
    "type-empty": [2, "never"],
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "docs",
        "style",
        "refactor",
        "perf",
        "test",
        "build",
        "ci",
        "chore",
        "revert",
      ],
    ],
    "subject-empty": [2, "never"],
    "header-max-length": [2, "always", 150],
    "custom-scope-required": [2, "always"],
  },
};