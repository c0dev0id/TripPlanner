/** A file in a zip, by its path in it. */
export interface ZipEntry {
  path: string;
  read: () => Promise<Blob>;
}

const END_OF_DIRECTORY = 0x06054b50;
const DIRECTORY_ENTRY = 0x02014b50;
const STORED = 0;
const DEFLATED = 8;

const view = async (blob: Blob): Promise<DataView> => new DataView(await blob.arrayBuffer());

/**
 * The files of a zip, read from its directory at the end; a file's content is read from
 * the zip only when asked for. Stored and deflated files are read, which is what zips
 * hold; a zip past 4 GB (ZIP64) or an encrypted one is refused.
 */
export async function zipEntries(zip: Blob): Promise<ZipEntry[]> {
  // The end record is 22 bytes and a comment of up to 65535 after it.
  const tailStart = Math.max(0, zip.size - 22 - 0xffff);
  const tail = await view(zip.slice(tailStart));
  let end = tail.byteLength - 22;
  while (end >= 0 && tail.getUint32(end, true) !== END_OF_DIRECTORY) end--;
  if (end < 0) throw new Error('This is no zip file.');
  const count = tail.getUint16(end + 10, true);
  const size = tail.getUint32(end + 12, true);
  const start = tail.getUint32(end + 16, true);
  if (count === 0xffff || start === 0xffffffff) throw new Error('The zip file is too large to be read here.');
  const directory = await view(zip.slice(start, start + size));
  const entries: ZipEntry[] = [];
  let at = 0;
  for (let i = 0; i < count; i++) {
    if (directory.getUint32(at, true) !== DIRECTORY_ENTRY) throw new Error('The zip file is damaged.');
    const encrypted = (directory.getUint16(at + 8, true) & 1) === 1;
    const method = directory.getUint16(at + 10, true);
    const packed = directory.getUint32(at + 20, true);
    const nameLength = directory.getUint16(at + 28, true);
    const local = directory.getUint32(at + 42, true);
    const path = new TextDecoder().decode(new Uint8Array(directory.buffer, at + 46, nameLength)).normalize('NFC');
    at += 46 + nameLength + directory.getUint16(at + 30, true) + directory.getUint16(at + 32, true);
    if (path.endsWith('/')) continue;
    entries.push({
      path,
      read: async () => {
        if (encrypted || (method !== STORED && method !== DEFLATED)) throw new Error(`${path} is packed in a way that cannot be read here.`);
        // The file's own header repeats its name and may carry other extra fields than the directory's.
        const header = await view(zip.slice(local, local + 30));
        const data = local + 30 + header.getUint16(26, true) + header.getUint16(28, true);
        const content = zip.slice(data, data + packed);
        return method === STORED ? content : new Response(content.stream().pipeThrough(new DecompressionStream('deflate-raw'))).blob();
      },
    });
  }
  return entries;
}
