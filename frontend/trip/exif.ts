/**
 * The EXIF of a photo as the camera wrote it, carried from the file picked to the JPEG
 * made of it in the browser: a canvas drawing has none, and the server places a photo by
 * its date and position. Read out of a JPEG's APP1 segment or a HEIF container's Exif
 * item, turned upright, and written into the new JPEG as an APP1 segment.
 */

const EXIF_HEADER = [0x45, 0x78, 0x69, 0x66, 0, 0]; // "Exif\0\0"
const ORIENTATION_TAG = 0x0112;
/** The largest APP1 payload a JPEG segment holds. */
const MAX_SEGMENT = 0xffff - 2;

/** The TIFF block of the file's EXIF, from a JPEG or a HEIF; none where there is none. */
export function exifOf(bytes: Uint8Array): Uint8Array<ArrayBuffer> | undefined {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return jpegExif(bytes);
  if (ascii(bytes, 4, 4) === 'ftyp') return heifExif(bytes);
  return undefined;
}

/** The TIFF with its orientation tag set to 1, for pixels already turned the way the tag said. A copy. */
export function upright(tiff: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(tiff);
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
  const little = out[0] === 0x49;
  const ifd = view.getUint32(4, little);
  if (ifd + 2 > out.length) return out;
  const count = view.getUint16(ifd, little);
  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > out.length) break;
    if (view.getUint16(entry, little) === ORIENTATION_TAG) view.setUint16(entry + 8, 1, little);
  }
  return out;
}

/** The JPEG with the TIFF as its APP1 segment, right after the start marker; unchanged when the TIFF is too large for a segment. */
export function withExif(jpeg: Uint8Array<ArrayBuffer>, tiff: Uint8Array): Uint8Array<ArrayBuffer> {
  const payload = EXIF_HEADER.length + tiff.length;
  if (payload > MAX_SEGMENT) return jpeg;
  const length = payload + 2;
  const out = new Uint8Array(jpeg.length + 4 + payload);
  out.set(jpeg.subarray(0, 2), 0);
  out.set([0xff, 0xe1, length >> 8, length & 0xff, ...EXIF_HEADER], 2);
  out.set(tiff, 2 + 4 + EXIF_HEADER.length);
  out.set(jpeg.subarray(2), 2 + 4 + payload);
  return out;
}

/** The file's name with a .jpg extension in place of its own. */
export function jpegName(name: string): string {
  return `${name.replace(/\.[^.]+$/, '')}.jpg`;
}

function ascii(bytes: Uint8Array, at: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(at, at + length));
}

/** The TIFF in the first APP1 segment that carries EXIF, before the image data begins. */
function jpegExif(bytes: Uint8Array): Uint8Array<ArrayBuffer> | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let i = 2;
  while (i + 4 <= bytes.length && bytes[i] === 0xff) {
    const marker = bytes[i + 1]!;
    if (marker === 0xda || marker === 0xd9) return undefined;
    const length = view.getUint16(i + 2);
    if (marker === 0xe1 && EXIF_HEADER.every((b, k) => bytes[i + 4 + k] === b)) return bytes.slice(i + 4 + EXIF_HEADER.length, i + 2 + length);
    i += 2 + length;
  }
  return undefined;
}

interface Box {
  type: string;
  /** The first byte after the box header, and the first byte after the box. */
  start: number;
  end: number;
}

/** The boxes between two offsets, in order. */
function boxes(bytes: Uint8Array, from: number, to: number): Box[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const found: Box[] = [];
  let i = from;
  while (i + 8 <= to) {
    let size = view.getUint32(i);
    let header = 8;
    if (size === 1) {
      size = Number(view.getBigUint64(i + 8));
      header = 16;
    } else if (size === 0) size = to - i;
    if (size < header) break;
    found.push({ type: ascii(bytes, i + 4, 4), start: i + header, end: Math.min(to, i + size) });
    i += size;
  }
  return found;
}

/**
 * The TIFF of a HEIF's Exif item: the item's id from the item information, its place in
 * the file from the item locations, and the TIFF header at the offset the item names.
 * Only an item stored in the file itself (construction method 0) is read.
 */
function heifExif(bytes: Uint8Array): Uint8Array<ArrayBuffer> | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const meta = boxes(bytes, 0, bytes.length).find((b) => b.type === 'meta');
  if (!meta) return undefined;
  const inside = boxes(bytes, meta.start + 4, meta.end);
  const iinf = inside.find((b) => b.type === 'iinf');
  const iloc = inside.find((b) => b.type === 'iloc');
  if (!iinf || !iloc) return undefined;
  const exifId = boxes(bytes, iinf.start + (bytes[iinf.start] === 0 ? 6 : 8), iinf.end)
    .filter((b) => b.type === 'infe' && bytes[b.start]! >= 2)
    .map((b) => (bytes[b.start] === 2 ? { id: view.getUint16(b.start + 4), kind: ascii(bytes, b.start + 8, 4) } : { id: view.getUint32(b.start + 4), kind: ascii(bytes, b.start + 10, 4) }))
    .find((item) => item.kind === 'Exif')?.id;
  if (exifId === undefined) return undefined;
  const version = bytes[iloc.start]!;
  const offsetSize = bytes[iloc.start + 4]! >> 4;
  const lengthSize = bytes[iloc.start + 4]! & 15;
  const baseOffsetSize = bytes[iloc.start + 5]! >> 4;
  const indexSize = version >= 1 ? bytes[iloc.start + 5]! & 15 : 0;
  const uint = (at: number, size: number): number => (size === 4 ? view.getUint32(at) : size === 8 ? Number(view.getBigUint64(at)) : 0);
  const count = version < 2 ? view.getUint16(iloc.start + 6) : view.getUint32(iloc.start + 6);
  let p = iloc.start + (version < 2 ? 8 : 10);
  for (let n = 0; n < count; n++) {
    const id = version < 2 ? view.getUint16(p) : view.getUint32(p);
    p += version < 2 ? 2 : 4;
    const method = version >= 1 ? view.getUint16(p) & 15 : 0;
    if (version >= 1) p += 2;
    p += 2; // data reference index
    const base = uint(p, baseOffsetSize);
    p += baseOffsetSize;
    const extents = view.getUint16(p);
    p += 2;
    for (let e = 0; e < extents; e++) {
      p += indexSize;
      const offset = uint(p, offsetSize);
      p += offsetSize;
      const length = uint(p, lengthSize);
      p += lengthSize;
      if (id === exifId && method === 0 && e === 0) {
        const item = bytes.subarray(base + offset, base + offset + length);
        const tiffAt = 4 + new DataView(item.buffer, item.byteOffset, item.byteLength).getUint32(0);
        return tiffAt < item.length ? item.slice(tiffAt) : undefined;
      }
    }
  }
  return undefined;
}
