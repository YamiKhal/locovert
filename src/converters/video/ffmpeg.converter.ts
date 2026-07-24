import type { Converter, ProgressCb } from "../../core/converter-manager"
import { extensionFromFile, normalizeExt } from "../../core/file-types"
import { CancelledError, ConversionFailedError } from "../../lib/errors"

interface Pending {
    resolve: (blob: Blob) => void
    reject: (err: Error) => void
    onProgress?: ProgressCb

    started?: boolean
}

const STALL_MS = 30_000

class StallError extends Error {}

let worker: Worker | null = null
let seq = 0
const pending = new Map<number, Pending>()

let lastActivity = 0

function getWorker(): Worker {
    if (worker) return worker
    worker = new Worker(
        new URL("../../workers/ffmpeg.worker.ts", import.meta.url),
        {
            type: "module",
        }
    )
    worker.onmessage = (e: MessageEvent) => {
        lastActivity = performance.now()
        const m = e.data
        if (m.type === "log") return
        const p = pending.get(m.id)
        if (!p) return
        if (m.type === "exec-start") {
            p.started = true
        } else if (m.type === "progress") {
            p.onProgress?.(m.ratio)
        } else if (m.type === "done") {
            pending.delete(m.id)
            p.resolve(new Blob([m.data]))
        } else if (m.type === "error") {
            pending.delete(m.id)
            p.reject(new ConversionFailedError(m.message))
        }
    }
    return worker
}

function killWorker() {
    if (worker) {
        worker.terminate()
        worker = null
    }
}

function attempt(
    args: string[],
    inName: string,
    outName: string,
    data: ArrayBuffer,
    forceST: boolean,
    watchdog: boolean,
    onProgress?: ProgressCb,
    signal?: AbortSignal
): Promise<Blob> {
    const id = ++seq
    const w = getWorker()
    return new Promise<Blob>((resolve, reject) => {
        let timer: ReturnType<typeof setInterval> | undefined
        const cleanup = () => {
            if (timer) clearInterval(timer)
            pending.delete(id)
        }
        const entry: Pending = {
            onProgress,
            resolve: (blob) => {
                cleanup()
                resolve(blob)
            },
            reject: (err) => {
                cleanup()
                reject(err)
            },
        }
        pending.set(id, entry)
        signal?.addEventListener("abort", () => {
            if (pending.has(id)) {
                cleanup()
                reject(new CancelledError())
            }
        })
        lastActivity = performance.now()
        if (watchdog) {
            timer = setInterval(() => {
                if (
                    entry.started &&
                    performance.now() - lastActivity > STALL_MS
                ) {
                    cleanup()
                    killWorker()
                    reject(new StallError())
                }
            }, 2000)
        }
        w.postMessage({ id, data, inName, outName, args, forceST }, [data])
    })
}

export async function runFFmpeg(
    file: File,
    inputExt: string,
    outputExt: string,
    extraArgs: string[],
    onProgress?: ProgressCb,
    signal?: AbortSignal
): Promise<Blob> {
    if (signal?.aborted) throw new CancelledError()

    const inName = `input.${inputExt}`
    const outName = `output.${outputExt}`
    const args = ["-i", inName, ...extraArgs, outName]
    const canMultithread = self.crossOriginIsolated

    try {
        const data = await file.arrayBuffer()
        return await attempt(
            args,
            inName,
            outName,
            data,
            false,
            canMultithread,
            onProgress,
            signal
        )
    } catch (err) {
        if (!(err instanceof StallError)) throw err
    }

    if (signal?.aborted) throw new CancelledError()
    onProgress?.(0)
    const data = await file.arrayBuffer()
    return attempt(args, inName, outName, data, true, false, onProgress, signal)
}

const VIDEO_IN = ["mp4", "mov", "mkv", "avi", "webm"]
const VIDEO_OUT = ["mp4", "webm"]

function argsFor(output: string): string[] {
    switch (output) {
        case "webm":
            return [
                "-c:v",
                "libvpx",
                "-b:v",
                "0",
                "-crf",
                "32",
                "-deadline",
                "good",
                "-cpu-used",
                "4",
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "libvorbis",
                "-q:a",
                "4",
            ]
        case "mp4":
            return [
                "-c:v",
                "libx264",
                "-preset",
                "fast",
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "aac",
            ]
        default:
            return []
    }
}

export const videoConverter: Converter = {
    id: "ffmpeg-video",

    supports(input, output) {
        return (
            VIDEO_IN.includes(normalizeExt(input)) &&
            VIDEO_OUT.includes(normalizeExt(output))
        )
    },

    outputsFor(input) {
        return VIDEO_IN.includes(normalizeExt(input)) ? [...VIDEO_OUT] : []
    },

    convert(file, output, onProgress, signal) {
        const inExt = extensionFromFile(file)
        const outExt = normalizeExt(output)
        return runFFmpeg(
            file,
            inExt,
            outExt,
            argsFor(outExt),
            onProgress,
            signal
        )
    },
}
