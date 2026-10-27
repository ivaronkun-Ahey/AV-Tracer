import { z } from 'zod';
import { PropValue } from '../types/device.types';

/** Значение параметра устройства в файлах проекта и в каталоге. */
export const propValueSchema: z.ZodType<PropValue> = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.union([z.string(), z.number()])),
]);

export const propMapSchema = z.record(z.string(), propValueSchema);

/** Параметры проверки: в ошибках нужно исходное значение, чтобы назвать его по-русски. */
export const PARSE_OPTIONS = { reportInput: true } as const;

/** Первая ошибка проверки — коротко и по-русски, с путём до поля. */
export function describeZodError(error: z.ZodError): string {
  const issue = error.issues[0];
  const where = issue.path.length ? ` (${issue.path.join('.')})` : '';
  let text = issue.message;
  if (issue.code === 'invalid_type') {
    text = issue.input === undefined ? 'нет обязательного поля' : `неверный тип: ${typeof issue.input}`;
  } else if (issue.code === 'invalid_value') {
    text = `недопустимое значение «${String(issue.input)}»`;
  }
  return `${text}${where}`;
}
