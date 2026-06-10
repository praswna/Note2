import { isTauriApp } from './tauri';
export { isTauriApp } from './tauri';

function sanitizeDirName(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '_').trim() || '_';
}

const MAX_WIDTH = 1920;
const JPEG_QUALITY = 0.85;

function compressToJpeg(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = img.naturalWidth > MAX_WIDTH ? MAX_WIDTH / img.naturalWidth : 1;
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff'; // flatten transparency
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

export async function saveImageFile(dataUrl: string, notebookPath: string[]): Promise<string> {
  if (!isTauriApp()) throw new Error('Image storage requires Tauri desktop app');

  dataUrl = await compressToJpeg(dataUrl);

  if (!dataUrl.startsWith('data:image/')) throw new Error('Invalid image data URL');
  const ext = 'jpg'; // always JPEG after compression

  const subdir = notebookPath.map(sanitizeDirName);

  const res = await fetch(dataUrl);
  const buf = await res.arrayBuffer();
  const bytes = Array.from(new Uint8Array(buf));
  const id = crypto.randomUUID();

  const { invoke, convertFileSrc } = await import('@tauri-apps/api/core');
  const filePath = await invoke<string>('save_image', { id, data: bytes, ext, subdir });
  return convertFileSrc(filePath);
}

export async function deleteImageFile(src: string): Promise<void> {
  if (!isTauriApp() || !src.startsWith('asset://')) return;
  const { invoke } = await import('@tauri-apps/api/core');
  const path = decodeURIComponent(src.replace(/^asset:\/\/localhost/, ''));
  await invoke<void>('delete_image', { path }).catch(() => {});
}
