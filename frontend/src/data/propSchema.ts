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

export const propMapSchema = z.record(propValueSchema);

/** Первая ошибка проверки — коротко и по-русски, с путём до поля. */
export function describeZodError(error: z.ZodError): string {
  const issue = error.issues[0];
  const where = issue.path.length ? ` (${issue.path.join('.')})` : '';
  let text = issue.message;
  if (issue.code === 'invalid_type') {
    text = issue.received === 'undefined' ? 'нет обязательного поля' : `неверный тип: ${issue.received}`;
  } else if (issue.code === 'invalid_enum_value') {
    text = `недопустимое значение «${String(issue.received)}»`;
  }
  return `${text}${where}`;
}
