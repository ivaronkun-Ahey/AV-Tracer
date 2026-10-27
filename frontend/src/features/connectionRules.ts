import { Connection, Device, Port } from '../types/device.types';
import { signalsCompatible } from '../sim/signalPaths';

/**
 * Занят ли порт кабелем. В один разъём физически входит один кабель:
 * вход и двунаправленный порт (Ethernet) принимают только одно соединение.
 * С выхода можно вести несколько кабелей (параллельное подключение АС,
 * Y-разветвитель), поэтому выход занятым не считается.
 */
export function isPortBusy(connections: Connection[], deviceId: string, port: Port): boolean {
  if (port.direction === 'output') return false;
  return connections.some(
    (c) =>
      (c.to.device === deviceId && c.to.port === port.id) ||
      (port.direction === 'bidirectional' && c.from.device === deviceId && c.from.port === port.id)
  );
}

export function findPort(devices: Device[], deviceId: string, portId: string): Port | undefined {
  return devices.find((d) => d.id === deviceId)?.ports.find((p) => p.id === portId);
}

/**
 * Почему кабель между двумя портами недопустим (null — можно подключать).
 * Используется и интерфейсом, и редьюсером: состояние не должно получить
 * кабель с несуществующим концом, не в ту сторону или между несовместимыми сигналами.
 */
export function connectionProblem(
  devices: Device[],
  connections: Connection[],
  from: { device: string; port: string },
  to: { device: string; port: string }
): string | null {
  const fromPort = findPort(devices, from.device, from.port);
  const toPort = findPort(devices, to.device, to.port);
  if (!fromPort || !toPort) return 'одного из концов кабеля больше нет на схеме';
  if (from.device === to.device) return 'нельзя соединить устройство само с собой';
  if (fromPort.direction === 'input') return 'кабель начинается с выхода';
  if (toPort.direction === 'output') return 'кабель подключается ко входу';
  if (!signalsCompatible(fromPort.signal_type, toPort.signal_type)) return 'несовместимые сигналы';
  if (isPortBusy(connections, to.device, toPort)) return 'вход уже занят';
  if (isPortBusy(connections, from.device, fromPort)) return 'порт уже занят';
  return null;
}
