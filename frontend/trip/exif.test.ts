import { describe, expect, it } from 'vitest';
import { exifOf, jpegName, upright, withExif } from './exif';

/** A 2 × 2 JPEG with the EXIF of a photo: taken 2027-06-12 14:30:05 at 47.6° N 11.1° E, orientation 6. */
const PHOTO = Uint8Array.from(
  atob(
    '/9j/4AAQSkZJRgABAQAAAQABAAD/4QDGRXhpZgAATU0AKgAAAAgAAwESAAMAAAABAAYAAIdpAAQAAAABAAAAMoglAAQAAAABAAAAWAAAAAAAAZADAAIAAAAUAAAARAAAAAAyMDI3OjA2OjEyIDE0OjMwOjA1AAAEAAEAAgAAAAJOAAAAAAIABQAAAAMAAACOAAMAAgAAAAJFAAAAAAQABQAAAAMAAACmAAAAAAAAAC8AAAABAAAAJAAAAAEAAAAAAAAAAQAAAAsAAAABAAAABgAAAAEAAAAAAAAAAf/bAEMAEAsMDgwKEA4NDhIREBMYKBoYFhYYMSMlHSg6Mz08OTM4N0BIXE5ARFdFNzhQbVFXX2JnaGc+TXF5cGR4XGVnY//bAEMBERISGBUYLxoaL2NCOEJjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY//AABEIAAIAAgMBIgACEQEDEQH/xAAfAAABBQEBAQEBAQAAAAAAAAAAAQIDBAUGBwgJCgv/xAC1EAACAQMDAgQDBQUEBAAAAX0BAgMABBEFEiExQQYTUWEHInEUMoGRoQgjQrHBFVLR8CQzYnKCCQoWFxgZGiUmJygpKjQ1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4eLj5OXm5+jp6vHy8/T19vf4+fr/xAAfAQADAQEBAQEBAQEBAAAAAAAAAQIDBAUGBwgJCgv/xAC1EQACAQIEBAMEBwUEBAABAncAAQIDEQQFITEGEkFRB2FxEyIygQgUQpGhscEJIzNS8BVictEKFiQ04SXxFxgZGiYnKCkqNTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqCg4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2dri4+Tl5ufo6ery8/T19vf4+fr/2gAMAwEAAhEDEQA/AG0UUV5Z7J//2Q==',
  ),
  (c) => c.charCodeAt(0),
);

/** The orientation tag's value in a big-endian TIFF, read the plain way. */
function orientationOf(tiff: Uint8Array): number | undefined {
  const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  const ifd = view.getUint32(4);
  for (let i = 0; i < view.getUint16(ifd); i++) {
    const entry = ifd + 2 + i * 12;
    if (view.getUint16(entry) === 0x0112) return view.getUint16(entry + 8);
  }
  return undefined;
}

const text = (s: string) => Array.from(s, (c) => c.charCodeAt(0));
const u16 = (n: number) => [n >> 8, n & 0xff];
const u32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
const box = (type: string, ...parts: number[][]): number[] => {
  const body = parts.flat();
  return [...u32(8 + body.length), ...text(type), ...body];
};

/** A HEIF container whose Exif item holds the given TIFF, located by an iloc of the given version. */
function heif(tiff: Uint8Array, ilocVersion: 0 | 1 | 2): Uint8Array {
  const payload = [...u32(6), ...text('Exif'), 0, 0, ...tiff];
  const ftyp = box('ftyp', text('heic'), u32(0), text('mif1heic'));
  const infe = box('infe', [2, 0, 0, 0], u16(7), u16(0), text('Exif'), [0]);
  const iinf = box('iinf', [0, 0, 0, 0], u16(1), infe);
  const iloc = (offset: number) => {
    const item = ilocVersion < 2 ? u16(7) : u32(7);
    const method = ilocVersion >= 1 ? u16(0) : [];
    const extent = [...(ilocVersion >= 1 ? u32(0) : []), ...u32(offset), ...u32(payload.length)];
    // Offsets, lengths and the base offset take four bytes each; from version 1 on, each extent has a four-byte index too.
    return box('iloc', [ilocVersion, 0, 0, 0], [0x44, ilocVersion >= 1 ? 0x44 : 0x40], ilocVersion < 2 ? u16(1) : u32(1), item, method, u16(0), u32(0), u16(1), extent);
  };
  const metaFor = (offset: number) => box('meta', [0, 0, 0, 0], box('hdlr', [0, 0, 0, 0], u32(0), text('pict'), u32(0), u32(0), u32(0), [0]), iinf, iloc(offset));
  const headerLength = ftyp.length + metaFor(0).length + 8;
  return Uint8Array.from([...ftyp, ...metaFor(headerLength), ...box('mdat', payload)]);
}

describe('exifOf', () => {
  it('reads the TIFF out of a JPEG', () => {
    const tiff = exifOf(PHOTO)!;
    expect(String.fromCharCode(tiff[0]!, tiff[1]!)).toBe('MM');
    expect(orientationOf(tiff)).toBe(6);
  });

  it('reads the TIFF out of a HEIF, whichever version its item locations have', () => {
    const tiff = exifOf(PHOTO)!;
    for (const version of [0, 1, 2] as const) expect(exifOf(heif(tiff, version))).toEqual(tiff);
  });

  it('finds none in a file without, or of another kind', () => {
    expect(exifOf(Uint8Array.from([0xff, 0xd8, 0xff, 0xdb, 0, 4, 0, 0, 0xff, 0xd9]))).toBeUndefined();
    expect(exifOf(Uint8Array.from(text('%PDF-1.4')))).toBeUndefined();
  });
});

describe('upright and withExif', () => {
  it('sets the orientation to 1 in a copy and writes the TIFF into a new JPEG', () => {
    const tiff = exifOf(PHOTO)!;
    const turned = upright(tiff);
    expect(orientationOf(turned)).toBe(1);
    expect(orientationOf(tiff)).toBe(6);
    const bare = Uint8Array.from([0xff, 0xd8, 0xff, 0xdb, 0, 4, 0, 0, 0xff, 0xd9]);
    const jpeg = withExif(bare, turned);
    expect(jpeg.length).toBe(bare.length + 4 + 6 + turned.length);
    expect(exifOf(jpeg)).toEqual(turned);
    expect(withExif(bare, new Uint8Array(70_000))).toBe(bare);
  });
});

describe('jpegName', () => {
  it('replaces the extension', () => {
    expect(jpegName('IMG_0001.HEIC')).toBe('IMG_0001.jpg');
    expect(jpegName('photo')).toBe('photo.jpg');
    expect(jpegName('my.holiday.png')).toBe('my.holiday.jpg');
  });
});
