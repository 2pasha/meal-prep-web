export const MAX_INPUT_BYTES = 10 * 1024 * 1024;

// Downscale a picked photo to a JPEG that fits the bucket limit (~100-200 KB at 1200px).
export async function resizeImage(file, maxSide = 1200, quality = 0.8) {
  if (!file.type.startsWith('image/')) throw new Error('not-an-image');
  if (file.size > MAX_INPUT_BYTES) throw new Error('too-large');

  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // flatten transparent PNGs onto white instead of black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) throw new Error('encode-failed');
  return blob;
}
