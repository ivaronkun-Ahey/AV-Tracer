import { describe, it, expect, beforeEach, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import canvasReducer, { initialCanvasState } from '../features/canvasSlice';
import lessonReducer, { initialLessonState } from '../features/lessonSlice';
import { createDevice, findEquipment } from '../data/equipment';
import { ProjectDoc } from '../types/device.types';
import { LESSONS } from './lessons';
import { Lesson } from './lessonSchema';
import { exitLessonSession, hasContent, hasStash, startLessonSession } from './session';

/**
 * Вход в задание и выход из него не теряют схему пользователя (обзор 28.10, N2).
 * Хранилище — в памяти, с возможностью отказа записи (переполнение, запрет).
 */
class MemoryStorage {
  data = new Map<string, string>();
  failWrites = false;
  get length() {
    return this.data.size;
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    if (this.failWrites) throw new DOMException('quota', 'QuotaExceededError');
    this.data.set(k, String(v));
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
  clear() {
    this.data.clear();
  }
}

let storage: MemoryStorage;
beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal('localStorage', storage);
});

const lesson = LESSONS[0];

function makeStore(doc: Partial<ProjectDoc> = {}, activeId: string | null = null) {
  return configureStore({
    reducer: { canvas: canvasReducer, lesson: lessonReducer },
    preloadedState: {
      canvas: { ...initialCanvasState, devices: [], connections: [], rooms: [], racks: [], meta: {}, ...doc },
      lesson: { ...initialLessonState, activeId },
    },
  });
}

const docOf = (store: ReturnType<typeof makeStore>) => {
  const { rooms, racks, meta, devices } = store.getState().canvas;
  return { rooms, racks, meta, devices: devices.map((d) => d.id) };
};

/** Вход в задание → перезагрузка страницы (на холсте — схема задания) → выход. */
function startReloadExit(doc: Partial<ProjectDoc>) {
  const store = makeStore(doc);
  const before = docOf(store);
  expect(startLessonSession(store.dispatch, store.getState(), lesson)).toBe(true);
  expect(store.getState().lesson.activeId).toBe(lesson.id);
  const { devices, connections, rooms } = store.getState().canvas;
  const reloaded = makeStore({ devices, connections, rooms }, lesson.id);
  exitLessonSession(reloaded.dispatch);
  return { before, after: docOf(reloaded), toast: reloaded.getState().canvas.toast };
}

describe('вход в задание и возврат своей схемы', () => {
  it('схема только с помещением, только со шкафом, только с данными штампа — возвращается после перезагрузки', () => {
    const cases: Partial<ProjectDoc>[] = [
      { rooms: [{ id: 'hall', name: 'Зал', color: '#5B8DEF' }] },
      { racks: [{ id: 'r1', name: 'ШТ-1', units: 42 }] },
      { meta: { object: 'Школа №1', code: '2026-01-СС' } },
    ];
    for (const doc of cases) {
      expect(hasContent({ devices: [], connections: [], rooms: [], ...doc })).toBe(true);
      const { before, after, toast } = startReloadExit(doc);
      expect(after).toEqual(before);
      expect(toast?.message).toBe('Ваша схема возвращена');
      expect(hasStash()).toBe(false);
    }
  });

  it('пустая схема: после выхода холст снова пустой, а не схема задания', () => {
    const { after } = startReloadExit({});
    expect(after).toEqual({ rooms: [], racks: [], meta: {}, devices: [] });
  });

  it('схему не сохранить (хранилище переполнено) — задание не начинается, схема на месте, причина в сообщении', () => {
    const mic = createDevice(findEquipment('shure-sm58')!, 'mic', { x: 0, y: 0 });
    const store = makeStore({ devices: [mic], rooms: [{ id: 'hall', name: 'Зал', color: '#5B8DEF' }] });
    const before = docOf(store);
    storage.failWrites = true;
    expect(startLessonSession(store.dispatch, store.getState(), lesson)).toBe(false);
    expect(store.getState().lesson.activeId).toBeNull();
    expect(docOf(store)).toEqual(before);
    expect(store.getState().canvas.toast).toMatchObject({ severity: 'error', message: expect.stringContaining('не удалось сохранить вашу схему') });
  });

  it('пустую схему можно не сохранять: задание начинается и при отказе хранилища', () => {
    const store = makeStore();
    storage.failWrites = true;
    expect(startLessonSession(store.dispatch, store.getState(), lesson)).toBe(true);
  });

  it('ошибка в самом задании — схема пользователя остаётся, копия не перезаписывается', () => {
    const broken: Lesson = { ...lesson, start: { ...lesson.solution, connections: [{ from: 'mic.no_such_port', to: 'spk.xlr_in' }] } };
    const store = makeStore({ rooms: [{ id: 'hall', name: 'Зал', color: '#5B8DEF' }] });
    expect(startLessonSession(store.dispatch, store.getState(), broken)).toBe(false);
    expect(store.getState().canvas.rooms).toHaveLength(1);
    expect(store.getState().canvas.toast?.message).toContain('mic.no_such_port');
    expect(hasStash()).toBe(false);
  });

  it('переход к следующему заданию не перезаписывает сохранённую схему', () => {
    const store = makeStore({ rooms: [{ id: 'hall', name: 'Зал', color: '#5B8DEF' }] });
    startLessonSession(store.dispatch, store.getState(), lesson);
    startLessonSession(store.dispatch, store.getState(), LESSONS[1]);
    exitLessonSession(store.dispatch);
    expect(store.getState().canvas.rooms.map((r) => r.name)).toEqual(['Зал']);
  });

  it('копию не прочитать — сообщение об ошибке, копия не удаляется без скачивания', () => {
    storage.setItem('av-tracer:before-lesson', '{"schemaVersion": 999, "devices": [], "connections": []}');
    const store = makeStore({}, lesson.id);
    exitLessonSession(store.dispatch);
    expect(store.getState().lesson.activeId).toBeNull();
    expect(store.getState().canvas.toast).toMatchObject({ severity: 'error', message: expect.stringContaining('более новой версией') });
    // В тестах скачивания нет (нет document) — копия остаётся в хранилище
    expect(hasStash()).toBe(true);
  });
});
