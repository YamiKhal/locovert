import { extensionFromFile } from "./file-types"

export type ProgressCb = (ratio: number) => void

export interface Converter {
    readonly id: string

    supports(input: string, output: string): boolean

    outputsFor(input: string): string[]

    convert(
        file: File,
        output: string,
        onProgress?: ProgressCb,
        signal?: AbortSignal
    ): Promise<Blob>
}

class ConverterManager {
    private readonly registry: Converter[] = []

    register(converter: Converter): void {
        if (this.registry.some((c) => c.id === converter.id)) return
        this.registry.push(converter)
    }

    getSupportedOutputs(file: File): string[] {
        const input = extensionFromFile(file)
        if (!input) return []
        const set = new Set<string>()
        for (const c of this.registry) {
            for (const out of c.outputsFor(input)) {
                if (out !== input) set.add(out)
            }
        }
        return [...set].sort()
    }

    private find(input: string, output: string): Converter | undefined {
        return this.registry.find((c) => c.supports(input, output))
    }

    async convert(
        file: File,
        output: string,
        onProgress?: ProgressCb,
        signal?: AbortSignal
    ): Promise<Blob> {
        const input = extensionFromFile(file)
        if (!input) throw new Error(`Cannot detect type of "${file.name}"`)
        const converter = this.find(input, output)
        if (!converter) {
            throw new Error(`No converter for ${input} to ${output}`)
        }
        return converter.convert(file, output, onProgress, signal)
    }
}

export const manager = new ConverterManager()
