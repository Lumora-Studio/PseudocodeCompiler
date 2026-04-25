import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@igcse/compiler": path.resolve(__dirname, "../../packages/compiler/src/index.ts"),
      "@igcse/compiler/types": path.resolve(__dirname, "../../packages/compiler/src/types.ts"),
      "@igcse/workspace": path.resolve(__dirname, "../../packages/workspace/src/index.ts"),
    },
  },
});
