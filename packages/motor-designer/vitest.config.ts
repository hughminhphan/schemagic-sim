import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    pool: "threads",
    fileParallelism: false,
    maxWorkers: 1,
  },
});
