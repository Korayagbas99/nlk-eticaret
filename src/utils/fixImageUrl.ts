// src/utils/fixImageUrl.ts
/**
 * iOS ATS: http uzak URL'leri engeller. (localhost/192.168.* hariç)
 * Bu helper güvenli https'e yükseltir ve ufak temizlemeler yapar.
 */
export function fixImageUrl(url?: string): string | undefined {
  if (!url) return undefined;
  let s = String(url).trim();

  // etrafındaki tırnakları at
  s = s.replace(/^['"]|['"]$/g, '');

  // base64 ise bırak
  if (s.startsWith('data:image')) return s;

  // protokolsüz //cdn... → https:
  if (s.startsWith('//')) s = 'https:' + s;

  // http ise ve local değilse → https (iOS ATS için)
  const isLocalHttp = /^http:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.)/i.test(s);
  if (s.startsWith('http://') && !isLocalHttp) {
    s = s.replace(/^http:\/\//i, 'https://');
  }

  // boşlukları temizle
  s = s.replace(/\s/g, '');
  return s;
}
