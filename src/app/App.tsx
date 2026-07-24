import { useEffect, useMemo, useRef, useState } from "react"
import { Activity, TriangleAlert } from "lucide-react"
import { FileDrop } from "../components/FileDrop"
import { ConverterCard, type Row } from "../components/ConverterCard"
import { SpecsModal, type ConversionStats } from "../components/SpecsModal"
import { registerConverters } from "../converters"
import { manager } from "../core/converter-manager"
import { extensionFromFile } from "../core/file-types"
import {
    downloadBlob,
    prefersReducedMotion,
    sleep,
    swapExtension,
    uniqueName,
} from "../lib/utils"
import { getHardwareInfo } from "../lib/hardware"
import { makeZip, type ZipEntry } from "../lib/zip"

let counter = 0
const HW = getHardwareInfo()

async function runPool<T>(
    items: T[],
    limit: number,
    fn: (item: T) => Promise<void>
) {
    let i = 0
    const workers = Array.from(
        { length: Math.min(limit, items.length) },
        async () => {
            while (i < items.length) {
                const idx = i++
                await fn(items[idx])
            }
        }
    )
    await Promise.all(workers)
}

export default function App() {
    const [rows, setRows] = useState<Row[]>([])
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [globalTarget, setGlobalTarget] = useState("")
    const [leaving, setLeaving] = useState<Set<string>>(new Set())
    const [zipping, setZipping] = useState(false)
    const [showSpecs, setShowSpecs] = useState(false)

    const rowsRef = useRef(rows)
    useEffect(() => {
        rowsRef.current = rows
    }, [rows])

    useEffect(() => {
        registerConverters()
    }, [])

    const patch = (id: string, next: Partial<Row>) =>
        setRows((prev) =>
            prev.map((r) => (r.id === id ? { ...r, ...next } : r))
        )

    function addFiles(files: File[]) {
        setRows((prev) => [
            ...prev,
            ...files.map<Row>((file) => {
                const outputs = manager.getSupportedOutputs(file)
                return {
                    id: `f${++counter}`,
                    file,
                    input: extensionFromFile(file),
                    outputs,
                    target: outputs[0] ?? "",
                    status: "idle",
                    progress: 0,
                    oversize: file.size > HW.maxFileSize,
                }
            }),
        ])
    }

    function purge(id: string) {
        setRows((prev) => prev.filter((r) => r.id !== id))
        setSelected((prev) => {
            const next = new Set(prev)
            next.delete(id)
            return next
        })
        setLeaving((prev) => {
            const next = new Set(prev)
            next.delete(id)
            return next
        })
    }

    function remove(id: string) {
        if (prefersReducedMotion()) {
            purge(id)
            return
        }

        setLeaving((prev) => new Set(prev).add(id))
        setTimeout(() => purge(id), 220)
    }

    function toggle(id: string) {
        setSelected((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const selectedRows = rows.filter((r) => selected.has(r.id))
    const scopeRows = selectedRows.length ? selectedRows : rows
    const selectable = rows.filter((r) => r.outputs.length > 0)
    const allSelected =
        selectable.length > 0 && selectable.every((r) => selected.has(r.id))

    const globalOptions = useMemo(
        () => [...new Set(scopeRows.flatMap((r) => r.outputs))].sort(),
        [scopeRows]
    )

    function toggleAll() {
        setSelected(
            allSelected ? new Set() : new Set(selectable.map((r) => r.id))
        )
    }

    function applyGlobalTarget(value: string) {
        setGlobalTarget(value)
        const scopeIds = new Set(scopeRows.map((r) => r.id))
        setRows((prev) =>
            prev.map((r) =>
                scopeIds.has(r.id) && r.outputs.includes(value)
                    ? { ...r, target: value }
                    : r
            )
        )
    }

    const bump = (id: string, value: number) =>
        setRows((prev) =>
            prev.map((r) =>
                r.id === id
                    ? { ...r, progress: Math.max(r.progress, value) }
                    : r
            )
        )

    async function convertOne(id: string) {
        const row = rowsRef.current.find((r) => r.id === id)
        if (!row || !row.target || row.oversize) return
        if (row.status === "converting") return

        const reduce = prefersReducedMotion()

        const minMs = reduce ? 0 : 420
        patch(id, {
            status: "converting",
            progress: reduce ? 100 : 6,
            error: undefined,
            result: undefined,
        })
        const start = performance.now()

        try {
            const blob = await manager.convert(row.file, row.target, (ratio) =>
                bump(id, Math.min(99, ratio * 100))
            )
            const elapsed = performance.now() - start
            if (elapsed < minMs) await sleep(minMs - elapsed)
            bump(id, 100)
            if (!reduce) await sleep(160)
            patch(id, {
                status: "done",
                progress: 100,
                result: {
                    blob,
                    name: swapExtension(row.file.name, row.target),
                },
            })
        } catch (err) {
            patch(id, {
                status: "error",
                error: err instanceof Error ? err.message : String(err),
            })
        }
    }

    const isConvertible = (r: Row) =>
        r.outputs.length > 0 &&
        !r.oversize &&
        r.status !== "converting" &&
        r.status !== "queued" &&
        r.status !== "done"

    async function convertScope() {
        if (anyBusy) return
        const targets = scopeRows.filter(isConvertible)
        if (!targets.length) return
        const ids = targets.map((r) => r.id)
        setRows((prev) =>
            prev.map((r) =>
                ids.includes(r.id) ? { ...r, status: "queued", progress: 0 } : r
            )
        )
        await runPool(ids, HW.parallelJobs, convertOne)
    }

    async function downloadAll() {
        const done = scopeRows.filter((r) => r.status === "done" && r.result)
        if (!done.length || zipping) return
        setZipping(true)
        try {
            const seen = new Set<string>()
            const entries: ZipEntry[] = done.map((r) => ({
                name: uniqueName(r.result!.name, seen),
                blob: r.result!.blob,
            }))
            const zip = await makeZip(entries)
            downloadBlob(zip, "locovert.zip")
        } finally {
            setZipping(false)
        }
    }

    const stats: ConversionStats = {
        files: rows.length,
        converted: rows.filter((r) => r.status === "done").length,
        inputBytes: rows.reduce((sum, r) => sum + r.file.size, 0),
        outputBytes: rows.reduce(
            (sum, r) => sum + (r.result?.blob.size ?? 0),
            0
        ),
        formats: [
            ...new Set(
                rows.filter((r) => r.status === "done").map((r) => r.target)
            ),
        ].sort(),
    }

    const anyBusy = rows.some(
        (r) => r.status === "converting" || r.status === "queued"
    )
    const pending = scopeRows.filter(isConvertible).length
    const doneCount = scopeRows.filter((r) => r.status === "done").length
    const scopeLabel = selectedRows.length ? "selected" : "all"

    return (
        <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-10">
            <header className="mb-16 flex flex-col md:flex-row gap-5 items-center md:items-center">
                <div className="w-sm">
                    <img
                        src="logo.png"
                        alt="locovert logo"
                        className="object-cover"
                    />
                </div>
                <div className="w-full text-center md:text-start">
                    <h1 className="text-6xl font-semibold tracking-tight text-(--text)">
                        Loco<span className="text-(--primary)">Vert</span>
                    </h1>
                    <p className="mt-1 w-full tracking-tight text-md text-(--text-dim)">
                        Convert files in your browser. Nothing ever leaves your
                        device.
                    </p>
                    <button
                        type="button"
                        onClick={() => setShowSpecs(true)}
                        className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-(--border) px-2.5 py-1 text-xs text-(--text-dim) transition-colors hover:border-(--primary) hover:text-(--primary)"
                        aria-label="Device and conversion stats"
                        title="Device & conversion stats"
                    >
                        <Activity size={14} />
                        Device stats
                    </button>
                    {!HW.memoryKnown && (
                        <p className="mt-1.5 text-[11px] leading-snug text-(--text-dim)">
                            <TriangleAlert
                                size={11}
                                className="mr-1 inline align-[-1px] text-(--primary)"
                            />
                            RAM imits are conservative. Chrome/Edge browsers
                            unlock higher.
                        </p>
                    )}
                </div>
            </header>

            {showSpecs && (
                <SpecsModal
                    hardware={HW}
                    stats={stats}
                    onClose={() => setShowSpecs(false)}
                />
            )}

            <FileDrop onFiles={addFiles} compact={rows.length > 0} />

            {rows.length > 0 && (
                <>
                    <div className="mt-5 flex flex-wrap items-center gap-3 rounded-lg border border-(--border) bg-(--surface) px-3 py-2">
                        <label className="flex items-center gap-2 text-xs text-(--text-dim)">
                            <input
                                type="checkbox"
                                checked={allSelected}
                                onChange={toggleAll}
                                className="size-4 cursor-pointer accent-(--primary)"
                            />
                            {selectedRows.length
                                ? `${selectedRows.length} selected`
                                : `${rows.length} files`}
                        </label>

                        <div className="flex items-center gap-2 text-xs text-(--text-dim)">
                            <span>set {scopeLabel} to</span>
                            <select
                                value={globalTarget}
                                onChange={(e) =>
                                    applyGlobalTarget(e.target.value)
                                }
                                className="cursor-pointer rounded border border-(--border) bg-(--surface-2) px-1.5 py-0.5 font-mono text-(--text) outline-none focus:border-(--primary)"
                            >
                                <option value="" disabled>
                                    format
                                </option>
                                {globalOptions.map((o) => (
                                    <option key={o} value={o}>
                                        {o.toUpperCase()}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="ml-auto flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setRows([])
                                    setSelected(new Set())
                                    setLeaving(new Set())
                                }}
                                disabled={anyBusy || zipping}
                                className="cursor-pointer rounded-md px-2.5 py-1 text-xs text-(--text-dim) transition-colors hover:text-(--primary) disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Clear
                            </button>
                            {doneCount > 0 && (
                                <button
                                    type="button"
                                    onClick={downloadAll}
                                    disabled={zipping}
                                    className="cursor-pointer rounded-md border border-(--border) px-2.5 py-1.5 text-xs font-medium text-(--text) transition-[color,border-color,transform] animate-[pop_0.25s_ease-out] hover:border-(--primary) hover:text-(--primary) active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    {zipping
                                        ? "Zipping..."
                                        : `Download all (${doneCount})`}
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={convertScope}
                                disabled={pending === 0 || anyBusy}
                                className="cursor-pointer rounded-md bg-(--primary) px-3 py-1.5 text-xs font-semibold text-white transition-[background-color,transform] hover:bg-(--primary-hover) active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {anyBusy
                                    ? "Converting..."
                                    : `Convert ${scopeLabel}${pending > 0 ? ` (${pending})` : ""}`}
                            </button>
                        </div>
                    </div>

                    <div className="mt-3 space-y-2">
                        {rows.map((row) => (
                            <ConverterCard
                                key={row.id}
                                row={row}
                                selected={selected.has(row.id)}
                                leaving={leaving.has(row.id)}
                                onToggle={() => toggle(row.id)}
                                onTargetChange={(t) =>
                                    patch(row.id, { target: t })
                                }
                                onConvert={() => convertOne(row.id)}
                                onRemove={() => remove(row.id)}
                            />
                        ))}
                    </div>
                </>
            )}

            <footer className="mt-10 text-center text-xs text-(--text-dim)">
                Brought to you by{" "}
                <span className="text-(--text)">Yamikhal</span>
            </footer>
        </main>
    )
}
