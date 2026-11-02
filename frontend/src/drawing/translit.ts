// prettier-ignore
const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

/**
 * Латиница для имён файлов: не все программы и архиваторы корректно показывают
 * кириллицу, а Chromium без окна подставляет вместо такого имени «download».
 */
export const translit = (s: string) => [...s].map((ch) => TRANSLIT[ch] ?? TRANSLIT[ch.toLowerCase()]?.toUpperCase() ?? ch).join('');

/** Имя файла из латиницы, цифр и «._-». */
export const safeFileName = (s: string) =>
  translit(s)
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '');
