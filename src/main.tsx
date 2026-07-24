import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import App from "./app/App.tsx"

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <App />
    </StrictMode>
)

if ("serviceWorker" in navigator && !import.meta.env.DEV) {
    window.addEventListener("load", () => {
        void navigator.serviceWorker.register(
            `${import.meta.env.BASE_URL}sw.js`
        )
        if (!crossOriginIsolated) {
            let reloaded = false
            navigator.serviceWorker.addEventListener("controllerchange", () => {
                if (reloaded) return
                reloaded = true
                window.location.reload()
            })
        }
    })
}
