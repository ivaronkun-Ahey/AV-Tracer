import { Connection, Device, Port } from '../types/device.types';

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
