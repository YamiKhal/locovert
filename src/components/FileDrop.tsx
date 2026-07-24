import { useRef, useState, type DragEvent } from "react"
import { cn } from "../lib/utils"
import { extensionFromFile, isSupportedExt } from "../core/file-types"
import { Upload } from "lucide-react"

interface FileDropProps {
    onFiles: (files: File[]) => void

    compact?: boolean
}

export function FileDrop({ onFiles, compact = false }: FileDropProps) {
    const inputRef = useRef<HTMLInputElement>(null)
    const [over, setOver] = useState(false)
    const [rejected, setRejected] = useState<string[]>([])

    function accept(list: FileList | null) {
        if (!list) return
        const files = [...list]
        const ok = files.filter((f) => isSupportedExt(extensionFromFile(f)))
        setRejected(
            files
                .filter((f) => !isSupportedExt(extensionFromFile(f)))
                .map((f) => f.name)
        )
        if (ok.length) onFiles(ok)
    }

    function onDrop(e: DragEvent<HTMLDivElement>) {
        e.preventDefault()
        setOver(false)
        accept(e.dataTransfer.files)
    }

    return (
        <div>
            <div
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                    e.preventDefault()
                    setOver(true)
                }}
                onDragLeave={() => setOver(false)}
                onDrop={onDrop}
                className={cn(
                    "flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed text-center text-sm transition-all duration-300 ease-out",
                    compact ? "px-4 py-2.5" : "px-6 py-5",
                    over
                        ? "border-(--primary) bg-(--primary-dim)"
                        : "border-(--border) hover:border-(--primary) hover:bg-(--surface)"
                )}
            >
                <div
                    className={cn(
                        "flex items-center justify-center transition-all duration-300 ease-out",
                        compact ? "flex-row gap-2" : "flex-col gap-3"
                    )}
                >
                    <Upload
                        size={compact ? 18 : 42}
                        className="transition-all duration-300 ease-out"
                    />
                    <div className="flex flex-row gap-1">
                        <span className="font-medium text-(--text)">
                            Drop files
                        </span>
                        <span className="text-(--text-dim)">
                            or click to browse
                        </span>
                    </div>
                </div>
                <input
                    ref={inputRef}
                    type="file"
                    multiple
                    hidden
                    onChange={(e) => {
                        accept(e.target.files)
                        e.target.value = ""
                    }}
                />
            </div>

            {rejected.length > 0 && (
                <p className="mt-2 text-xs text-(--primary)">
                    Skipped {rejected.length} unsupported: {rejected.join(", ")}
                </p>
            )}
        </div>
    )
}
