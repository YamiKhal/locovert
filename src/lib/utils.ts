import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]): string {
    return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number): string {
    if (bytes <= 0) return "0 B"
    const units = ["B", "KB", "MB", "GB", "TB"]
    const i = Math.min(
        units.length - 1,
        Math.floor(Math.log(bytes) / Math.log(1024))
    )
    const value = bytes / 1024 ** i
    return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()

    setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function swapExtension(name: string, ext: string): string {
    const dot = name.lastIndexOf(".")
    const base = dot < 0 ? name : name.slice(0, dot)
    return `${base}.${ext.replace(/^\./, "")}`
}

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

export function prefersReducedMotion(): boolean {
    return (
        typeof matchMedia === "function" &&
        matchMedia("(prefers-reduced-motion: reduce)").matches
    )
}

export function uniqueName(name: string, seen: Set<string>): string {
    if (!seen.has(name)) {
        seen.add(name)
        return name
    }
    const dot = name.lastIndexOf(".")
    const base = dot < 0 ? name : name.slice(0, dot)
    const ext = dot < 0 ? "" : name.slice(dot)
    let i = 1
    let candidate = `${base} (${i})${ext}`
    while (seen.has(candidate)) {
        i += 1
        candidate = `${base} (${i})${ext}`
    }
    seen.add(candidate)
    return candidate
}
