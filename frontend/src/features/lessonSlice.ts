import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { CheckResult } from '../learning/checks';

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
}

export const initialLessonState: LessonState = {
  activeId: null,
  hintsShown: 0,
  results: null,
  solved: false,
  solutionShown: false,
  showAllEquipment: false,
  completed: [],
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
  },
});

export const { startLesson, exitLesson, showHint, setResults, markSolutionShown, toggleAllEquipment } = lessonSlice.actions;
export default lessonSlice.reducer;
