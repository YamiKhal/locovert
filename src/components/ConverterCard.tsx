import { Check } from "lucide-react"
import { downloadBlob, formatBytes } from "../lib/utils"
import { ProgressBar } from "./ProgressBar"

export type RowStatus = "idle" | "queued" | "converting" | "done" | "error"

export interface Row {
    id: string
    file: File
    input: string
    outputs: string[]
    target: string
    status: RowStatus
    progress: number
    error?: string
    result?: { blob: Blob; name: string }

    oversize?: boolean
}

interface ConverterCardProps {
    row: Row
    selected: boolean

    leaving?: boolean
    onToggle: () => void
    onTargetChange: (target: string) => void
    onConvert: () => void
    onRemove: () => void
}

export function ConverterCard({
    row,
    selected,
    leaving = false,
    onToggle,
    onTargetChange,
    onConvert,
    onRemove,
}: ConverterCardProps) {
    const {
        file,
        input,
        outputs,
        target,
        status,
        progress,
        error,
        result,
        oversize,
    } = row
    const busy = status === "converting" || status === "queued"
    const done = status === "done"
    const noOutputs = outputs.length === 0 || oversize

    return (
        <div
            className={
                "relative overflow-hidden rounded-lg border bg-(--surface) px-3 py-2 transition-colors " +
                (done ? "border-(--primary)/40 " : "border-(--border) ") +
                (leaving
                    ? "animate-[rowOut_0.22s_ease-in_forwards] pointer-events-none"
                    : "animate-[rowIn_0.22s_ease-out]")
            }
            data-status={status}
        >
            <div className="flex items-center gap-3">
                <input
                    type="checkbox"
                    checked={selected}
                    onChange={onToggle}
                    disabled={noOutputs}
                    className="size-4 shrink-0 accent-(--primary) enabled:cursor-pointer disabled:cursor-not-allowed"
                    aria-label={`Select ${file.name}`}
                />

                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-(--text)">
                        {file.name}
                    </p>
                    <p className="text-xs text-(--text-dim)">
                        {formatBytes(file.size)}
                    </p>
                </div>

                <div className="flex shrink-0 items-center gap-1.5 text-xs">
                    <span className="rounded bg-(--surface-2) px-1.5 py-0.5 font-mono text-(--text-dim)">
                        {input.toUpperCase() || "?"}
                    </span>
                    <span className="text-(--text-dim)">to</span>
                    {noOutputs ? (
                        <span className="text-(--primary)">
                            {oversize ? "too large" : "n/a"}
                        </span>
                    ) : done ? (
                        <span
                            className="flex items-center gap-1 rounded border border-(--primary)/40 bg-(--primary-dim) px-1.5 py-0.5 font-mono text-(--primary)"
                            title="Converted"
                        >
                            {target.toUpperCase()}
                            <Check size={12} />
                        </span>
                    ) : (
                        <select
                            value={target}
                            onChange={(e) => onTargetChange(e.target.value)}
                            disabled={busy}
                            className="rounded border border-(--border) bg-(--surface-2) px-1.5 py-0.5 font-mono text-(--text) outline-none focus:border-(--primary) enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label={`Target format for ${file.name}`}
                        >
                            {outputs.map((o) => (
                                <option key={o} value={o}>
                                    {o.toUpperCase()}
                                </option>
                            ))}
                        </select>
                    )}
                </div>

                <div className="flex w-24 shrink-0 items-center justify-end gap-1">
                    {status === "done" && result ? (
                        <button
                            type="button"
                            onClick={() =>
                                downloadBlob(result.blob, result.name)
                            }
                            className="cursor-pointer rounded-md bg-(--primary) px-2.5 py-1 text-xs font-medium text-white transition-transform animate-[pop_0.25s_ease-out] hover:bg-(--primary-hover) active:scale-95"
                        >
                            Download
                        </button>
                    ) : status === "converting" ? (
                        <span className="text-xs tabular-nums text-(--text-dim)">
                            {Math.round(progress)}%
                        </span>
                    ) : status === "queued" ? (
                        <span className="text-xs text-(--text-dim)">
                            queued
                        </span>
                    ) : (
                        !noOutputs && (
                            <button
                                type="button"
                                onClick={onConvert}
                                className="cursor-pointer rounded-md border border-(--border) px-2.5 py-1 text-xs font-medium text-(--text) transition-[color,border-color,transform] hover:border-(--primary) hover:text-(--primary) active:scale-95"
                            >
                                Convert
                            </button>
                        )
                    )}
                    <button
                        type="button"
                        onClick={onRemove}
                        disabled={busy}
                        className="flex size-6 cursor-pointer items-center justify-center rounded text-(--text-dim) transition-colors hover:bg-(--surface-2) hover:text-(--primary) disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={`Remove ${file.name}`}
                    >
                        &times;
                    </button>
                </div>
            </div>

            {status === "error" && (
                <p className="mt-1 pl-7 text-xs text-(--primary)">{error}</p>
            )}
            {oversize && (
                <p className="mt-1 pl-7 text-xs text-(--text-dim)">
                    Too large for safe in-browser conversion on this device.
                </p>
            )}

            {status === "converting" && (
                <div className="absolute inset-x-0 bottom-0">
                    <ProgressBar progress={progress} className="rounded-none" />
                </div>
            )}
        </div>
    )
}
