import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  verbose: true,
  collectCoverageFrom: [
    "lib/src/**/*.{ts,tsx}",
    "!lib/src/**/*.test.{ts,tsx}",
    "!lib/src/**/__tests__/**",
    "!lib/src/**/*.d.ts",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "text-summary", "html", "lcov"],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};

export default config;
