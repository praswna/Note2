export const isTauriApp = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

// Strip characters that are unsafe in directory names on all platforms
function sanitizeDirName(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '_').trim() || '_';
}

/**
 * Saves an image file under {appLocalDataDir}/images/{notebookPath...}/{uuid}.{ext}
 * so the folder structure mirrors the notebook tree.
 */
export async function saveImageFile(dataUrl: string, notebookPath: string[]): Promise<string> {
  if (!isTauriApp()) throw new Error('Image storage requires Tauri desktop app');

  const match = dataUrl.match(/^data:image\/(\w+);base64,/);
  if (!match) throw new Error('Invalid image data URL');
  const ext = match[1] === 'jpeg' ? 'jpg' : match[1];

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
