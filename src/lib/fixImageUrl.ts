// src/lib/fixImageUrl.ts
export function fixImageUrl(url?: string): string | undefined {
  if (!url) return undefined;
  let s = url.trim();
  if (!s) return undefined;

  // Dropbox -> raw
  if (s.includes('dropbox.com')) {
    s = s.replace('www.dropbox.com', 'dl.dropboxusercontent.com');
    s = s.replace('?dl=0', '?raw=1');
  }

  // Google Drive "file/d/ID" veya "?id=ID"
  const m =
    s.match(/drive\.google\.com\/file\/d\/([^/]+)/) ||
    s.match(/[?&]id=([^&]+)/);
  if (m && m[1]) {
    s = `https://drive.google.com/uc?export=view&id=${m[1]}`;
  }

  return s;
}
