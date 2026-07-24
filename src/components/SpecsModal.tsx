import { useEffect } from "react"
import {
    Cpu,
    MemoryStick,
    Layers,
    Gauge,
    HardDrive,
    TriangleAlert,
    X,
} from "lucide-react"
import type { HardwareInfo } from "../lib/hardware"
import { formatBytes } from "../lib/utils"

export interface ConversionStats {
    files: number
    converted: number
    inputBytes: number
    outputBytes: number
    formats: string[]
}

interface SpecsModalProps {
    hardware: HardwareInfo
    stats: ConversionStats
    onClose: () => void
}

function Stat({
    icon,
    label,
    value,
}: {
    icon: React.ReactNode
    label: string
    value: string
}) {
    return (
        <div className="flex items-center gap-3 rounded-lg border border-(--border) bg-(--surface-2) px-3 py-2.5">
            <span className="text-(--primary)">{icon}</span>
            <div className="min-w-0">
                <p className="text-xs text-(--text-dim)">{label}</p>
                <p className="truncate text-sm font-medium text-(--text)">
                    {value}
                </p>
            </div>
        </div>
    )
}

export function SpecsModal({ hardware, stats, onClose }: SpecsModalProps) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose()
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [onClose])

    const saved = stats.inputBytes - stats.outputBytes

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-[fadeIn_0.15s_ease-out]"
            onClick={onClose}
            role="presentation"
        >
            <div
                className="w-full max-w-md rounded-xl border border-(--border) bg-(--surface) p-5 shadow-xl animate-[pop_0.2s_ease-out]"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="Device and conversion stats"
            >
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-(--text)">
                        This device
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex size-7 cursor-pointer items-center justify-center rounded text-(--text-dim) transition-colors hover:bg-(--surface-2) hover:text-(--primary)"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="space-y-4">
                    <section>
                        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-(--text-dim)">
                            Hardware
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
                            <Stat
                                icon={<Cpu size={18} />}
                                label="CPU cores"
                                value={`${hardware.cores}`}
                            />
                            <Stat
                                icon={<MemoryStick size={18} />}
                                label="Memory"
                                value={
                                    hardware.memoryKnown
                                        ? `${hardware.memory} GB`
                                        : `~${hardware.memory} GB`
                                }
                            />
                        </div>
                        {!hardware.memoryKnown && (
                            <div className="mt-2 flex items-start gap-2 rounded-lg border border-(--primary)/40 bg-(--primary-dim) px-3 py-2 text-xs text-(--text-dim)">
                                <TriangleAlert
                                    size={14}
                                    className="mt-0.5 shrink-0 text-(--primary)"
                                />
                                <p>
                                    Your browser hides real memory, so this is a{" "}
                                    <span className="text-(--text)">
                                        conservative guess
                                    </span>
                                    . file-size and parallelism limits below may
                                    be lower than your machine can handle. A
                                    Chromium browser (Chrome, Edge) reports it
                                    and unlocks higher limits.
                                </p>
                            </div>
                        )}
                    </section>

                    <section>
                        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-(--text-dim)">
                            Conversion budget
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
                            <Stat
                                icon={<Gauge size={18} />}
                                label="Parallel jobs"
                                value={`${hardware.parallelJobs}`}
                            />
                            <Stat
                                icon={<Layers size={18} />}
                                label="Worker threads"
                                value={`${hardware.threads}`}
                            />
                            <Stat
                                icon={<HardDrive size={18} />}
                                label="Max file size"
                                value={formatBytes(hardware.maxFileSize)}
                            />
                        </div>
                    </section>

                    <section>
                        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-(--text-dim)">
                            This session
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
                            <Stat
                                icon={<Layers size={18} />}
                                label="Files loaded"
                                value={`${stats.files}`}
                            />
                            <Stat
                                icon={<Gauge size={18} />}
                                label="Converted"
                                value={`${stats.converted}`}
                            />
                            <Stat
                                icon={<HardDrive size={18} />}
                                label="Input size"
                                value={formatBytes(stats.inputBytes)}
                            />
                            <Stat
                                icon={<HardDrive size={18} />}
                                label="Output size"
                                value={formatBytes(stats.outputBytes)}
                            />
                        </div>
                        {stats.converted > 0 && (
                            <p className="mt-2 text-xs text-(--text-dim)">
                                {saved >= 0 ? "Saved" : "Grew by"}{" "}
                                {formatBytes(Math.abs(saved))}
                                {stats.formats.length > 0 &&
                                    ` · ${stats.formats.join(", ").toUpperCase()}`}
                            </p>
                        )}
                    </section>
                </div>
            </div>
        </div>
    )
}
