/// <reference lib="webworker" />
import { precacheAndRoute, createHandlerBoundToURL } from "workbox-precaching"
import { registerRoute, NavigationRoute } from "workbox-routing"
import { CacheFirst } from "workbox-strategies"
import { ExpirationPlugin } from "workbox-expiration"
import { CacheableResponsePlugin } from "workbox-cacheable-response"

declare const self: ServiceWorkerGlobalScope & {
    __WB_MANIFEST: Array<{ url: string; revision: string | null }>
}

self.skipWaiting()
self.addEventListener("activate", (event) =>
    event.waitUntil(self.clients.claim())
)

precacheAndRoute(self.__WB_MANIFEST)

const shellHandler = createHandlerBoundToURL("index.html")
registerRoute(
    new NavigationRoute(async (params) => {
        const response = await shellHandler(params)
        const headers = new Headers(response.headers)
        headers.set("Cross-Origin-Embedder-Policy", "require-corp")
        headers.set("Cross-Origin-Opener-Policy", "same-origin")
        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers,
        })
    })
)

registerRoute(
    ({ url }) => url.pathname.endsWith(".wasm"),
    new CacheFirst({
        cacheName: "ffmpeg-wasm",
        plugins: [
            new CacheableResponsePlugin({ statuses: [0, 200] }),
            new ExpirationPlugin({
                maxEntries: 6,
                maxAgeSeconds: 60 * 60 * 24 * 90,
            }),
        ],
    })
)
