import { defineConfig } from "vite";

export default defineConfig(({ mode }) => {
  return {
    base: mode === "development" ? "/" : "{{BASE_URL}}/",
  };
});
