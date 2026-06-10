// Detects whether the app is running inside a Tauri desktop window
export const isTauriApp = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/**
 * Saves an image and returns a URL suitable for use in an <img> src.
 * - Tauri: writes the binary to {appLocalDataDir}/images/{uuid}.{ext},
 *          returns an asset:// URL via convertFileSrc
 * - Browser (dev): returns the original data URL unchanged
 */
export async function saveImageFile(dataUrl: string): Promise<string> {
  if (!isTauriApp()) return dataUrl;

  const match = dataUrl.match(/^data:image\/(\w+);base64,/);
  if (!match) return dataUrl;
  const rawExt = match[1];
  const ext = rawExt === 'jpeg' ? 'jpg' : rawExt;

  // Convert data URL → Uint8Array without btoa length limits
  const res = await fetch(dataUrl);
  const buf = await res.arrayBuffer();
  const bytes = Array.from(new Uint8Array(buf));

  const id = crypto.randomUUID();

  const { invoke, convertFileSrc } = await import('@tauri-apps/api/core');
  const filePath = await invoke<string>('save_image', { id, data: bytes, ext });
  return convertFileSrc(filePath);
}

/**
 * Deletes an image file that was previously saved via saveImageFile.
 * Only acts when src is an asset:// URL (i.e. a Tauri file reference).
 */
export async function deleteImageFile(src: string): Promise<void> {
  if (!isTauriApp() || !src.startsWith('asset://')) return;
  const { invoke } = await import('@tauri-apps/api/core');
  // asset://localhost/abs/path  →  /abs/path
  const path = decodeURIComponent(src.replace(/^asset:\/\/localhost/, ''));
  await invoke<void>('delete_image', { path }).catch(() => {});
}
