const CRC_TABLE = (() => {
    const table = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
        let c = n
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
        table[n] = c >>> 0
    }
    return table
})()

function crc32(data: Uint8Array): number {
    let crc = 0xffffffff
    for (let i = 0; i < data.length; i++) {
        crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)
    }
    return (crc ^ 0xffffffff) >>> 0
}

function sanitizeName(name: string): string {
    const clean = name
        .replace(/\\/g, "/")
        .split("/")
        .filter((s) => s && s !== "." && s !== "..")
        .join("/")
        .replace(/^[a-zA-Z]:/, "")
    return clean || "file"
}

export interface ZipEntry {
    name: string
    blob: Blob
}

export async function makeZip(entries: ZipEntry[]): Promise<Blob> {
    const enc = new TextEncoder()
    const parts: Uint8Array[] = []
    const central: Uint8Array[] = []
    let offset = 0

    const dosDate = 0x0021
    const dosTime = 0x0000

    for (const entry of entries) {
        const data = new Uint8Array(await entry.blob.arrayBuffer())
        const name = enc.encode(sanitizeName(entry.name))
        const crc = crc32(data)

        const local = new DataView(new ArrayBuffer(30))
        local.setUint32(0, 0x04034b50, true)
        local.setUint16(4, 20, true)
        local.setUint16(6, 0, true)
        local.setUint16(8, 0, true)
        local.setUint16(10, dosTime, true)
        local.setUint16(12, dosDate, true)
        local.setUint32(14, crc, true)
        local.setUint32(18, data.length, true)
        local.setUint32(22, data.length, true)
        local.setUint16(26, name.length, true)
        local.setUint16(28, 0, true)
        const localHeader = new Uint8Array(local.buffer)
        parts.push(localHeader, name, data)

        const cd = new DataView(new ArrayBuffer(46))
        cd.setUint32(0, 0x02014b50, true)
        cd.setUint16(4, 20, true)
        cd.setUint16(6, 20, true)
        cd.setUint16(8, 0, true)
        cd.setUint16(10, 0, true)
        cd.setUint16(12, dosTime, true)
        cd.setUint16(14, dosDate, true)
        cd.setUint32(16, crc, true)
        cd.setUint32(20, data.length, true)
        cd.setUint32(24, data.length, true)
        cd.setUint16(28, name.length, true)
        cd.setUint16(30, 0, true)
        cd.setUint16(32, 0, true)
        cd.setUint16(34, 0, true)
        cd.setUint16(36, 0, true)
        cd.setUint32(38, 0, true)
        cd.setUint32(42, offset, true)
        central.push(new Uint8Array(cd.buffer), name)

        offset += localHeader.length + name.length + data.length
    }

    const centralStart = offset
    const centralSize = central.reduce((sum, c) => sum + c.length, 0)

    const eocd = new DataView(new ArrayBuffer(22))
    eocd.setUint32(0, 0x06054b50, true)
    eocd.setUint16(4, 0, true)
    eocd.setUint16(6, 0, true)
    eocd.setUint16(8, entries.length, true)
    eocd.setUint16(10, entries.length, true)
    eocd.setUint32(12, centralSize, true)
    eocd.setUint32(16, centralStart, true)
    eocd.setUint16(20, 0, true)

    const blobParts = [...parts, ...central, new Uint8Array(eocd.buffer)]

    return new Blob(blobParts as unknown as BlobPart[], {
        type: "application/zip",
    })
}
