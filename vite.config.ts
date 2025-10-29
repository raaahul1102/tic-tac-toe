import { defineConfig } from "vite"

export default defineConfig({
    build: {
        ssr: true,
        rollupOptions: {
            input: {
                server: "./server.ts"
            },
            output: {
                format: "es",
                entryFileNames: "[name].mjs"
            }
        },
        sourcemap: true
    },
    ssr: {
        noExternal: true,
        resolve: {
            conditions: ["node"]
        }
    }
})

