import type { Converter, ProgressCb } from "../../core/converter-manager"
import { normalizeExt } from "../../core/file-types"
import { ConversionFailedError } from "../../lib/errors"

const READABLE = ["txt", "md", "html"]
const OUT: Record<string, string[]> = {
    txt: ["md", "html", "pdf"],
    md: ["txt", "html", "pdf"],
    html: ["txt", "md", "pdf"],
}

const MIME: Record<string, string> = {
    txt: "text/plain",
    md: "text/markdown",
    html: "text/html",
    pdf: "application/pdf",
}

function escapeHtml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function txtToHtml(text: string): string {
    const body = text
        .replace(/\r/g, "")
        .split(/\n{2,}/)
        .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
        .join("\n")
    return `<!doctype html>\n<html>\n<head><meta charset="utf-8"></head>\n<body>\n${body}\n</body>\n</html>\n`
}

function mdToHtml(md: string): string {
    const lines = md.replace(/\r/g, "").split("\n")
    const out: string[] = []
    let inList = false
    const inline = (s: string): string =>
        escapeHtml(s)
            .replace(/`([^`]+)`/g, "<code>$1</code>")
            .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
            .replace(/\*([^*]+)\*/g, "<em>$1</em>")
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')

    for (const line of lines) {
        const heading = line.match(/^(#{1,6})\s+(.*)$/)
        const item = line.match(/^\s*[-*]\s+(.*)$/)
        if (heading) {
            if (inList) {
                out.push("</ul>")
                inList = false
            }
            const level = heading[1].length
            out.push(`<h${level}>${inline(heading[2])}</h${level}>`)
        } else if (item) {
            if (!inList) {
                out.push("<ul>")
                inList = true
            }
            out.push(`<li>${inline(item[1])}</li>`)
        } else if (line.trim() === "") {
            if (inList) {
                out.push("</ul>")
                inList = false
            }
        } else {
            if (inList) {
                out.push("</ul>")
                inList = false
            }
            out.push(`<p>${inline(line)}</p>`)
        }
    }
    if (inList) out.push("</ul>")
    return `<!doctype html>\n<html>\n<head><meta charset="utf-8"></head>\n<body>\n${out.join("\n")}\n</body>\n</html>\n`
}

/** Strip tags to plain text, decode a few common entities. */
function htmlToText(html: string): string {
    return html
        .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
        .replace(/<\s*br\s*\/?\s*>/gi, "\n")
        .replace(/<\s*\/\s*(p|div|h[1-6]|li|tr)\s*>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/\n{3,}/g, "\n\n")
        .trim()
}

function pdfEscape(s: string): string {
    return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")
}

/** Break text into lines that fit a page width by character count. */
function wrapLines(text: string, max = 95): string[] {
    const out: string[] = []
    for (const raw of text.replace(/\r/g, "").split("\n")) {
        let line = raw
        while (line.length > max) {
            let cut = line.lastIndexOf(" ", max)
            if (cut <= 0) cut = max
            out.push(line.slice(0, cut))
            line = line.slice(cut).replace(/^ /, "")
        }
        out.push(line)
    }
    return out
}

/**
 * Minimal, dependency-free PDF writer for plain text. Helvetica, multi-page,
 * with a correct cross-reference table so real viewers open it.
 */
function textToPdf(text: string): Blob {
    const lines = wrapLines(text)
    const perPage = 50
    const leading = 14
    const top = 760
    const left = 54
    const fontSize = 11

    const pages: string[][] = []
    for (let i = 0; i < lines.length; i += perPage)
        pages.push(lines.slice(i, i + perPage))
    if (pages.length === 0) pages.push([""])

    // Fixed ids: 1 catalog, 2 pages, 3 font, then page/content pairs from 4.
    const pageIds: number[] = []
    const contentIds: number[] = []
    let id = 4
    for (let p = 0; p < pages.length; p++) {
        pageIds.push(id++)
        contentIds.push(id++)
    }
    const total = id - 1

    const objects: string[] = []
    objects[1] = "<< /Type /Catalog /Pages 2 0 R >>"
    objects[2] = `<< /Type /Pages /Kids [${pageIds.map((n) => `${n} 0 R`).join(" ")}] /Count ${pages.length} >>`
    objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"

    pages.forEach((pageLines, p) => {
        let stream = `BT /F1 ${fontSize} Tf ${leading} TL ${left} ${top} Td\n`
        pageLines.forEach((line, i) => {
            if (i > 0) stream += "T*\n"
            stream += `(${pdfEscape(line)}) Tj\n`
        })
        stream += "ET"
        objects[pageIds[p]] =
            `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ` +
            `/Resources << /Font << /F1 3 0 R >> >> /Contents ${contentIds[p]} 0 R >>`
        objects[contentIds[p]] =
            `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
    })

    const encoder = new TextEncoder()
    const chunks: Uint8Array[] = []
    const offsets: number[] = new Array(total + 1).fill(0)
    let pos = 0
    const push = (s: string) => {
        const bytes = encoder.encode(s)
        chunks.push(bytes)
        pos += bytes.length
    }

    push("%PDF-1.4\n")
    for (let n = 1; n <= total; n++) {
        offsets[n] = pos
        push(`${n} 0 obj\n${objects[n]}\nendobj\n`)
    }

    const xrefStart = pos
    let xref = `xref\n0 ${total + 1}\n0000000000 65535 f \n`
    for (let n = 1; n <= total; n++) {
        xref += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`
    }
    push(xref)
    push(
        `trailer\n<< /Size ${total + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`
    )

    return new Blob(chunks as BlobPart[], { type: "application/pdf" })
}

/** Document converter: txt, md, html interchange plus PDF export. */
export const documentConverter: Converter = {
    id: "document",

    supports(input, output) {
        const i = normalizeExt(input)
        return (
            READABLE.includes(i) &&
            (OUT[i]?.includes(normalizeExt(output)) ?? false)
        )
    },

    outputsFor(input) {
        return OUT[normalizeExt(input)] ?? []
    },

    async convert(
        file: File,
        output: string,
        onProgress?: ProgressCb
    ): Promise<Blob> {
        const input = normalizeExt(file.name.split(".").pop() ?? "")
        const out = normalizeExt(output)
        onProgress?.(0)
        const text = await file.text()

        let blob: Blob
        if (out === "pdf") {
            const plain = input === "html" ? htmlToText(text) : text
            blob = textToPdf(plain)
        } else if (out === "html") {
            const html =
                input === "md"
                    ? mdToHtml(text)
                    : input === "txt"
                      ? txtToHtml(text)
                      : text
            blob = new Blob([html], { type: MIME.html })
        } else {
            // txt or md target: from html we strip tags, otherwise keep the source text.
            const plain = input === "html" ? htmlToText(text) : text
            blob = new Blob([plain], { type: MIME[out] })
        }

        if (!blob.size) throw new ConversionFailedError("Produced empty output")
        onProgress?.(1)
        return blob
    },
}
