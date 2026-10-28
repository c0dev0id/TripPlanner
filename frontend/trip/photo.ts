import { exifOf, jpegName, upright, withExif } from './exif';

/**
 * Photos are made into JPEGs in the browser before they are uploaded: at most MAX_SIDE_PX
 * on the longer side, upright, with the EXIF of the original, so that a phone sends a
 * fraction of the bytes and a HEIC becomes something every browser shows. A file that is
 * no photo, or one the browser cannot decode, is uploaded as it is.
 */

export const MAX_SIDE_PX = 2560;
const QUALITY = 0.85;

const isHeif = (file: File): boolean => file.type === 'image/heic' || file.type === 'image/heif' || /\.(heic|heif)$/i.test(file.name);
const isPhoto = (file: File): boolean => file.type.startsWith('image/') || isHeif(file);

export async function prepareUpload(file: File): Promise<File> {
  if (!isPhoto(file)) return file;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const bitmap = await decode(file, bytes);
    const jpeg = new Uint8Array(await (await encodeJpeg(bitmap)).arrayBuffer());
    bitmap.close();
    const exif = exifOf(bytes);
    return new File([exif ? withExif(jpeg, upright(exif)) : jpeg], jpegName(file.name), { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

/** The photo's pixels, turned the way its orientation tag says; a HEIC through libheif where the browser does not read it. */
async function decode(file: File, bytes: Uint8Array): Promise<ImageBitmap> {
  if (!isHeif(file)) return createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return decodeHeif(bytes);
  }
}

/** libheif, compiled to WebAssembly, loaded the first time a HEIC needs it. */
async function decodeHeif(bytes: Uint8Array): Promise<ImageBitmap> {
  const libheif = await (await import('libheif-js/libheif-wasm/libheif-bundle.mjs')).default();
  const [image] = new libheif.HeifDecoder().decode(bytes);
  if (!image) throw new Error('The file holds no image.');
  const width = image.get_width();
  const height = image.get_height();
  const pixels = await new Promise<Uint8ClampedArray<ArrayBuffer>>((resolve, reject) => {
    image.display({ data: new Uint8ClampedArray(width * height * 4), width, height }, (shown) => (shown ? resolve(shown.data) : reject(new Error('The HEIC could not be decoded.'))));
  });
  return createImageBitmap(new ImageData(pixels, width, height));
}

async function encodeJpeg(bitmap: ImageBitmap): Promise<Blob> {
  const scale = Math.min(1, MAX_SIDE_PX / Math.max(bitmap.width, bitmap.height));
  const canvas = new OffscreenCanvas(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale));
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.convertToBlob({ type: 'image/jpeg', quality: QUALITY });
}
