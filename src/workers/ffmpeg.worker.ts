import { FFmpeg } from "@ffmpeg/ffmpeg"
import { toBlobURL } from "@ffmpeg/util"

let forceST = false

let ffmpeg: FFmpeg | null = null
let variant: "st" | "mt" = "st"
let currentId = 0

const logs: string[] = []

interface RunMessage {
    id: number
    data: ArrayBuffer
    inName: string
    outName: string
    args: string[]
    forceST?: boolean
}

async function getFFmpeg(): Promise<FFmpeg> {
    if (ffmpeg) return ffmpeg
    variant = self.crossOriginIsolated && !forceST ? "mt" : "st"
    const dir = `${import.meta.env.BASE_URL}ffmpeg/${variant}/`
    const ff = new FFmpeg()
    ff.on("progress", ({ progress }) => {
        const ratio = Math.max(0, Math.min(1, progress))
        postMessage({ type: "progress", id: currentId, ratio })
    })
    ff.on("log", ({ message }) => {
        logs.push(message)
        if (logs.length > 60) logs.shift()
        postMessage({ type: "log", message })
    })
    postMessage({ type: "log", message: `loading ffmpeg core: ${variant}` })
    const coreURL = await toBlobURL(`${dir}ffmpeg-core.js`, "text/javascript")
    const wasmURL = await toBlobURL(
        `${dir}ffmpeg-core.wasm`,
        "application/wasm"
    )
    if (variant === "mt") {
        const workerURL = await toBlobURL(
            `${dir}ffmpeg-core.worker.js`,
            "text/javascript"
        )
        await ff.load({ coreURL, wasmURL, workerURL })
    } else {
        await ff.load({ coreURL, wasmURL })
    }
    ffmpeg = ff
    return ff
}

async function handle(msg: RunMessage): Promise<void> {
    currentId = msg.id
    logs.length = 0
    try {
        const ff = await getFFmpeg()
        await ff.writeFile(msg.inName, new Uint8Array(msg.data))

        const execArgs = [...msg.args]
        if (variant === "mt") {
            const n = Math.max(
                1,
                Math.min(navigator.hardwareConcurrency || 2, 4)
            )
            execArgs.splice(execArgs.length - 1, 0, "-threads", String(n))
        }

        postMessage({ type: "exec-start", id: msg.id })
        const code = await ff.exec(execArgs)
        if (code !== 0) {
            throw new Error(`ffmpeg exited with code ${code}`)
        }
        const out = (await ff.readFile(msg.outName)) as Uint8Array
        if (!out.length) throw new Error("ffmpeg produced no output")

        const copy = out.slice()
        await ff.deleteFile(msg.inName).catch(() => {})
        await ff.deleteFile(msg.outName).catch(() => {})
        postMessage(
            { type: "done", id: msg.id, data: copy.buffer, name: msg.outName },
            [copy.buffer]
        )
    } catch (err) {
        const tail = logs.slice(-6).join(" | ")
        const base = err instanceof Error ? err.message : String(err)
        postMessage({
            type: "error",
            id: msg.id,
            message: tail ? `${base} - ${tail}` : base,
        })
    }
}

let queue: Promise<void> = Promise.resolve()
self.onmessage = (e: MessageEvent<RunMessage>) => {
    const msg = e.data
    if (msg.forceST) forceST = true
    queue = queue.then(() => handle(msg))
}
