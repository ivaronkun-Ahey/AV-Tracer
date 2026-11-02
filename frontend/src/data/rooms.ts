import { Room } from '../types/device.types';

/** Цвета рамок помещений: различимы между собой и с цветами сигналов на тёмном и светлом фоне. */
export const ROOM_COLORS = ['#5B8DEF', '#E0A030', '#4DB6AC', '#BA68C8', '#E57373', '#81C784', '#F06292', '#90A4AE'];

/** Следующий свободный цвет (по кругу, если помещений больше, чем цветов). */
export function nextRoomColor(rooms: Room[]): string {
  const used = new Set(rooms.map((r) => r.color));
  return ROOM_COLORS.find((c) => !used.has(c)) ?? ROOM_COLORS[rooms.length % ROOM_COLORS.length];
}

export function newRoomId(): string {
  return `room_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Название по умолчанию: «Помещение 1», «Помещение 2»… — первое незанятое. */
export function nextRoomName(rooms: Room[]): string {
  const names = new Set(rooms.map((r) => r.name));
  let n = rooms.length + 1;
  while (names.has(`Помещение ${n}`)) n += 1;
  return `Помещение ${n}`;
}

/** Название помещения по id; пустая строка — устройство без помещения. */
export function roomNameOf(rooms: Room[], id: string | undefined): string {
  return (id && rooms.find((r) => r.id === id)?.name) || '';
}
