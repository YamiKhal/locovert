import type { Converter, ProgressCb } from "../../core/converter-manager"
import { normalizeExt } from "../../core/file-types"
import { ConversionFailedError } from "../../lib/errors"

const DECODABLE = ["png", "jpg", "jpeg", "gif", "bmp", "webp", "avif"]

const ENCODABLE = ["png", "jpg", "jpeg", "webp"]

const MIME: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
}

export const imageConverter: Converter = {
    id: "image",

    supports(input, output) {
        return (
            DECODABLE.includes(normalizeExt(input)) &&
            ENCODABLE.includes(normalizeExt(output))
        )
    },

    outputsFor(input) {
        return DECODABLE.includes(normalizeExt(input)) ? [...ENCODABLE] : []
    },

    async convert(
        file: File,
        output: string,
        onProgress?: ProgressCb
    ): Promise<Blob> {
        const out = normalizeExt(output)
        const mime = MIME[out]
        if (!mime) throw new ConversionFailedError(`Cannot encode ${out}`)

        onProgress?.(0)
        const bitmap = await createImageBitmap(file).catch(() => {
            throw new ConversionFailedError("Could not decode image")
        })
        onProgress?.(0.5)

        try {
            const canvas = document.createElement("canvas")
            canvas.width = bitmap.width
            canvas.height = bitmap.height
            const ctx = canvas.getContext("2d")
            if (!ctx) throw new ConversionFailedError("Canvas 2D unavailable")

            if (mime === "image/jpeg") {
                ctx.fillStyle = "#ffffff"
                ctx.fillRect(0, 0, canvas.width, canvas.height)
            }
            ctx.drawImage(bitmap, 0, 0)

            const blob = await new Promise<Blob | null>((resolve) =>
                canvas.toBlob(resolve, mime, 0.92)
            )
            if (!blob)
                throw new ConversionFailedError("Encoding produced no data")
            onProgress?.(1)
            return blob
        } finally {
            bitmap.close()
        }
    },
}
