import { manager } from "../core/converter-manager"
import { imageConverter } from "./image/image.converter"
import { audioConverter } from "./audio/audio.converter"
import { videoConverter } from "./video/ffmpeg.converter"
import { documentConverter } from "./documents/document.converter"

export function registerConverters(): void {
    manager.register(imageConverter)
    manager.register(audioConverter)
    manager.register(videoConverter)
    manager.register(documentConverter)
}
