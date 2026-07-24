export interface HardwareInfo {
    cores: number
    memory: number
    threads: number
    parallelJobs: number
    maxFileSize: number
    memoryKnown: boolean
}

export function getHardwareInfo(): HardwareInfo {
    const cores = navigator.hardwareConcurrency ?? 2
    // @ts-expect-error deviceMemory is not in every lib.dom.
    const reportedMemory = navigator.deviceMemory as number | undefined
    const memoryKnown = typeof reportedMemory === "number"
    const memory = reportedMemory ?? 4

    const threads = Math.max(1, cores - 1)

    const parallelJobs = Math.max(1, Math.min(threads, Math.floor(memory / 2)))

    const maxFileSize = memory * 256 * 1024 * 1024

    return { cores, memory, threads, parallelJobs, maxFileSize, memoryKnown }
}
