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

/**
 * Имена свойств Object.prototype («constructor», «__proto__», «toString»…): идентификатор
 * с таким именем как ключ обычного объекта JS ломает словари, поэтому в файлах не допускается.
 */
const RESERVED_IDS = new Set(Object.getOwnPropertyNames(Object.prototype));
export const isReservedId = (id: string) => RESERVED_IDS.has(id);

/** Идентификатор во внешнем файле (проект, задание): непустой, не длиннее max, не служебное имя JS. */
export const identifierSchema = (max: number) =>
  z
    .string()
    .min(1, 'пустой идентификатор')
    .max(max, `строка длиннее ${max} символов`)
    .refine((v) => !isReservedId(v), { error: (issue) => `служебное имя «${String(issue.input)}» нельзя использовать как идентификатор` });

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
