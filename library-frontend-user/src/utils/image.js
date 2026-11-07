const DEFAULT_WIDTH = 300;

export function cloudinaryThumb(url, width = DEFAULT_WIDTH) {
  if (typeof url !== 'string' || !url.trim()) return '';

  const normalizedWidth = Math.max(1, Math.floor(Number(width) || DEFAULT_WIDTH));
  const uploadPath = '/image/upload/';
  const uploadIndex = url.indexOf(uploadPath);

  if (uploadIndex === -1 || !url.startsWith('https://res.cloudinary.com/')) return url;

  const insertAt = uploadIndex + uploadPath.length;
  const transformations = `f_auto,q_auto,w_${normalizedWidth}/`;
  return `${url.slice(0, insertAt)}${transformations}${url.slice(insertAt)}`;
}
