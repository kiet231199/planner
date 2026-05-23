import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";


// Vite provides the local React development server and production build.
export default defineConfig({
    plugins: [react()],
});
