import type { Converter } from "../../core/converter-manager"
import { extensionFromFile, normalizeExt } from "../../core/file-types"
import { runFFmpeg } from "../video/ffmpeg.converter"

const AUDIO = ["mp3", "wav", "ogg", "aac", "flac"]

function argsFor(output: string): string[] {
    switch (output) {
        case "mp3":
            return ["-c:a", "libmp3lame", "-q:a", "2"]
        case "aac":
            return ["-c:a", "aac", "-b:a", "192k"]
        case "ogg":
            return ["-c:a", "libvorbis", "-q:a", "5"]
        case "flac":
            return ["-c:a", "flac"]
        case "wav":
            return ["-c:a", "pcm_s16le"]
        default:
            return []
    }
}

export const audioConverter: Converter = {
    id: "ffmpeg-audio",

    supports(input, output) {
        return (
            AUDIO.includes(normalizeExt(input)) &&
            AUDIO.includes(normalizeExt(output))
        )
    },

    outputsFor(input) {
        return AUDIO.includes(normalizeExt(input))
            ? AUDIO.filter((e) => e !== normalizeExt(input))
            : []
    },

    convert(file, output, onProgress, signal) {
        const inExt = extensionFromFile(file)
        const outExt = normalizeExt(output)

        return runFFmpeg(
            file,
            inExt,
            outExt,
            ["-vn", ...argsFor(outExt)],
            onProgress,
            signal
        )
    },
}
