import lessonsJson from '../data/lessons.json';
import { parseLessons } from './lessonSchema';

/** Учебные задания из lessons.json (проверены схемой при загрузке). */
export const LESSONS = parseLessons(lessonsJson);

export const findLesson = (id: string | null | undefined) => LESSONS.find((l) => l.id === id);
