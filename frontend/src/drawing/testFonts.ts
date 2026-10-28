import regularFont from '../../public/fonts/PTSansNarrow-Regular.ttf?inline';
import boldFont from '../../public/fonts/PTSansNarrow-Bold.ttf?inline';
import type { DrawingFonts } from './pdf';

/** Шрифты для тестов: сборщик встраивает файл как data: URL, переводим в байты. */
const bytes = (dataUrl: string) => Uint8Array.from(atob(dataUrl.slice(dataUrl.indexOf(',') + 1)), (c) => c.charCodeAt(0));

export const testFonts = (): DrawingFonts => ({ regular: bytes(regularFont), bold: bytes(boldFont) });
