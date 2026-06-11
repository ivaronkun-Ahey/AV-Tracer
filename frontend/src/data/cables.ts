import { CableType } from '../types/device.types';

/** Рекомендуемая максимальная длина кабеля (метры) до риска потери сигнала. */
export const CABLE_MAX_LENGTH: Record<CableType, number> = {
  xlr: 100,
  trs: 15,
  speakon: 50,
  hdmi: 15,
  sdi: 100,
  cat6: 100,
  rca: 10,
  bnc: 100,
  usb: 5,
};

/** Короткое описание разъёма/кабеля для инспектора. */
export const CABLE_DESCRIPTION: Record<CableType, string> = {
  xlr: 'XLR — балансный аналоговый аудиокабель',
  trs: 'TRS/Jack 6.3 мм — балансный/небалансный аудиокабель',
  speakon: 'Speakon — спикерный кабель (усилитель → пассивная АС)',
  hdmi: 'HDMI — цифровое видео и аудио',
  sdi: 'SDI (BNC) — профессиональное видео по коаксиалу',
  cat6: 'Cat6 — витая пара (сеть, Dante, AV-over-IP)',
  rca: 'RCA — небалансный аналоговый сигнал',
  bnc: 'BNC — коаксиальный разъём (SDI/видео)',
  usb: 'USB — подключение к компьютеру',
};

export function cableMaxLength(cable: CableType): number {
  return CABLE_MAX_LENGTH[cable] ?? 100;
}
