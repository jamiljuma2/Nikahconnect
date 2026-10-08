import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  server: {
    warmup: {
      ssrFiles: [
        "./src/lib/account.functions.ts",
        "./src/lib/admin.functions.ts",
        "./src/lib/dating.functions.ts",
        "./src/lib/messaging.functions.ts",
        "./src/lib/payments.functions.ts",
        "./src/lib/payhero-settings.functions.ts",
      ],
    },
  },
  plugins: [
    tsconfigPaths(),
    tailwindcss(),
    tanstackStart({ customViteReactPlugin: true }),
    react(),
  ],
});
