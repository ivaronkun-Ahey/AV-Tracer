import lessonsJson from '../data/lessons.json';
import { Lesson, parseLessons } from './lessonSchema';

/** Учебные задания из lessons.json (проверены схемой при загрузке). */
export const LESSONS = parseLessons(lessonsJson);

/** Задание по id — среди встроенных и своих (редактор преподавателя, файлы). */
export const findLesson = (id: string | null | undefined, custom: Lesson[] = []) =>
  LESSONS.find((l) => l.id === id) ?? custom.find((l) => l.id === id);
