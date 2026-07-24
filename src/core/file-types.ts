export const FILE_TYPES = {
    image: ["png", "jpg", "jpeg", "gif", "bmp", "tiff", "webp", "avif"],
    video: ["mp4", "mov", "mkv", "avi", "webm"],
    audio: ["mp3", "wav", "ogg", "aac", "flac"],
    document: ["pdf", "txt", "docx", "md", "html"],
} as const

export const ALL_EXTENSIONS: readonly string[] =
    Object.values(FILE_TYPES).flat()

const MIME_TO_EXT: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/bmp": "bmp",
    "image/tiff": "tiff",
    "image/webp": "webp",
    "image/avif": "avif",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/x-matroska": "mkv",
    "video/x-msvideo": "avi",
    "video/webm": "webm",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/ogg": "ogg",
    "audio/aac": "aac",
    "audio/flac": "flac",
    "application/pdf": "pdf",
    "text/plain": "txt",
    "text/markdown": "md",
    "text/html": "html",
}

export function normalizeExt(ext: string): string {
    return ext.replace(/^\./, "").toLowerCase()
}

export function extensionFromName(name: string): string {
    const dot = name.lastIndexOf(".")
    if (dot < 0 || dot === name.length - 1) return ""
    return normalizeExt(name.slice(dot + 1))
}

export function mimeToExtension(mime: string): string {
    return MIME_TO_EXT[mime.toLowerCase()] ?? ""
}

export function extensionFromFile(file: File): string {
    return extensionFromName(file.name) || mimeToExtension(file.type)
}

export function isSupportedExt(ext: string): boolean {
    return ALL_EXTENSIONS.includes(normalizeExt(ext))
}
