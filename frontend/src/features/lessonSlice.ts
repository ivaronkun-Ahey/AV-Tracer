import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { CheckResult } from '../learning/checks';
import type { Lesson } from '../learning/lessonSchema';

/** Состояние учебного режима: задание, подсказки, результат проверки, пройденные задания. */
export interface LessonState {
  activeId: string | null;
  hintsShown: number;
  results: CheckResult[] | null;
  solved: boolean;
  /** Ученик открыл эталонное решение — задание не засчитывается. */
  solutionShown: boolean;
  /** Показать всю библиотеку, а не только оборудование задания. */
  showAllEquipment: boolean;
  completed: string[];
  /** Свои задания (редактор преподавателя или загруженные из файла). */
  custom: Lesson[];
}

export const initialLessonState: LessonState = {
  activeId: null,
  hintsShown: 0,
  results: null,
  solved: false,
  solutionShown: false,
  showAllEquipment: false,
  completed: [],
  custom: [],
};

const lessonSlice = createSlice({
  name: 'lesson',
  initialState: initialLessonState,
  reducers: {
    startLesson: (state, action: PayloadAction<string>) => {
      state.activeId = action.payload;
      state.hintsShown = 0;
      state.results = null;
      state.solved = false;
      state.solutionShown = false;
      state.showAllEquipment = false;
    },
    exitLesson: (state) => {
      state.activeId = null;
      state.results = null;
      state.solved = false;
    },
    showHint: (state, action: PayloadAction<number>) => {
      state.hintsShown = Math.min(action.payload, state.hintsShown + 1);
    },
    setResults: (state, action: PayloadAction<{ results: CheckResult[]; solved: boolean } | null>) => {
      state.results = action.payload?.results ?? null;
      state.solved = action.payload?.solved ?? false;
      if (action.payload?.solved && state.activeId && !state.solutionShown && !state.completed.includes(state.activeId)) {
        state.completed.push(state.activeId);
      }
    },
    markSolutionShown: (state) => {
      state.solutionShown = true;
      state.results = null;
      state.solved = false;
    },
    toggleAllEquipment: (state) => {
      state.showAllEquipment = !state.showAllEquipment;
    },
    /** Добавить задание или заменить задание с тем же id. */
    saveCustomLessons: (state, action: PayloadAction<Lesson[]>) => {
      for (const lesson of action.payload) {
        const i = state.custom.findIndex((l) => l.id === lesson.id);
        if (i >= 0) state.custom[i] = lesson;
        else state.custom.push(lesson);
      }
    },
    removeCustomLesson: (state, action: PayloadAction<string>) => {
      state.custom = state.custom.filter((l) => l.id !== action.payload);
      state.completed = state.completed.filter((id) => id !== action.payload);
    },
  },
});

export const {
  startLesson,
  exitLesson,
  showHint,
  setResults,
  markSolutionShown,
  toggleAllEquipment,
  saveCustomLessons,
  removeCustomLesson,
} = lessonSlice.actions;
export default lessonSlice.reducer;
