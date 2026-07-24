import fs from "node:fs"
import path from "node:path"
import { defineConfig, type Plugin } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { VitePWA } from "vite-plugin-pwa"

// Cross-origin isolation, required so the multi-threaded FFmpeg core can use
// SharedArrayBuffer. In production these are injected by the service worker; in
// dev and preview we set them directly on the server.
const ISOLATION_HEADERS = {
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp",
}

// Copy the self-hosted FFmpeg cores into public/ffmpeg/* so Vite serves them as
// static files, completely outside its module transform pipeline. This matters:
// if Vite transforms the emscripten core (appending ?import, rewriting
// import.meta.url) the mt core cannot locate its pthread worker or wasm and
// crashes. Two variants: st (single-thread fallback) and mt (multi-thread,
// needs cross-origin isolation). The ESM build is used because @ffmpeg/ffmpeg's
// module worker imports the core via import().default. Files are regenerated on
// demand and gitignored, never committed.
function ffmpegCoreAssets(): Plugin {
    const variants = {
        st: {
            dir: path.resolve("node_modules/@ffmpeg/core/dist/esm"),
            files: ["ffmpeg-core.js", "ffmpeg-core.wasm"],
        },
        mt: {
            dir: path.resolve("node_modules/@ffmpeg/core-mt/dist/esm"),
            files: ["ffmpeg-core.js", "ffmpeg-core.wasm", "ffmpeg-core.worker.js"],
        },
    }
    const sync = () => {
        for (const [name, variant] of Object.entries(variants)) {
            const outDir = path.resolve("public/ffmpeg", name)
            fs.mkdirSync(outDir, { recursive: true })
            for (const f of variant.files) {
                const src = path.join(variant.dir, f)
                const dst = path.join(outDir, f)
                if (!fs.existsSync(dst) || fs.statSync(dst).size !== fs.statSync(src).size) {
                    fs.copyFileSync(src, dst)
                }
            }
        }
    }
    return {
        name: "ffmpeg-core-assets",
        buildStart() {
            sync()
        },
    }
}

export default defineConfig({
    server: { headers: ISOLATION_HEADERS },
    preview: { headers: ISOLATION_HEADERS },
    plugins: [
        ffmpegCoreAssets(),
        react(),
        tailwindcss(),
        VitePWA({
            strategies: "injectManifest",
            srcDir: "src",
            filename: "sw.ts",
            registerType: "autoUpdate",
            // We register manually in main.tsx so we can reload once for isolation.
            injectRegister: false,
            injectManifest: {
                // Precache the light app shell only. The 32 MB wasm files are
                // excluded and runtime-cached on first use by the service worker.
                globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest}"],
                maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
            },
            manifest: {
                name: "Locovert",
                short_name: "Locovert",
                description: "Local file converter",
                theme_color: "#1b1b1d",
                background_color: "#1b1b1d",
            },
            devOptions: { enabled: false },
        }),
    ],
})
