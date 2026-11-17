export default {
  preset: "ts-jest",
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        // The transformer handles Vite's import.meta.env before CommonJS emit.
        diagnostics: { ignoreCodes: [1343] },
        astTransformers: { before: ["<rootDir>/test/viteEnvTransformer.cjs"] },
      },
    ],
  },
  testEnvironment: "jest-environment-jsdom",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "\\.(css|less|sass|scss)$": "identity-obj-proxy",
  },
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  setupFilesAfterEnv: ["<rootDir>/src/jest.setup.ts"],
};
