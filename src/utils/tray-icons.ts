import { nativeImage } from 'electron';
import { deflateSync } from 'zlib';

const crcTable: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf: Buffer): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crcBuf]);
}

function coloredCirclePng(r: number, g: number, b: number, size = 16): Buffer {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const c = (size - 1) / 2;
  const rad = size / 2 - 1.5;

  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c);
      const p = row + 1 + x * 4;
      if (d <= rad) {
        raw[p] = r; raw[p + 1] = g; raw[p + 2] = b; raw[p + 3] = 255;
      }
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

export function createTrayIcon(state: 'idle' | 'recording' | 'processing'): Electron.NativeImage {
  const colors: Record<string, [number, number, number]> = {
    idle: [70, 130, 220],
    recording: [220, 50, 50],
    processing: [220, 160, 50],
  };
  const [r, g, b] = colors[state];
  return nativeImage.createFromBuffer(coloredCirclePng(r, g, b));
}
