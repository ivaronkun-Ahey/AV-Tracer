import React, { useContext } from 'react';
import { Arrow, Label, Tag, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Connection, Device, Room } from '../types/device.types';
import { useAppDispatch } from '../store';
import { selectConnection } from '../features/canvasSlice';
import { roomNameOf } from '../data/rooms';
import { portAnchor, signalColor } from './deviceGeometry';
import { CanvasRenderContext } from './canvasTheme';

interface OffRoomStubProps {
  connection: Connection;
  /** Конец кабеля, который виден при фильтре по помещению. */
  visibleEnd: 'from' | 'to';
  devices: Device[];
  connections: Connection[];
  rooms: Room[];
  tags: Record<string, string>;
}

const STUB = 70;

/**
 * Кабель в другое помещение при фильтре: короткий отрезок от порта со стрелкой
 * и адресом второго конца («→ Аппаратная · MIX-01»), как обрыв линии на чертеже.
 */
const OffRoomStub: React.FC<OffRoomStubProps> = ({ connection, visibleEnd, devices, connections, rooms, tags }) => {
  const dispatch = useAppDispatch();
  const { palette, interactive } = useContext(CanvasRenderContext);
  const here = visibleEnd === 'from' ? connection.from : connection.to;
  const there = visibleEnd === 'from' ? connection.to : connection.from;
  const device = devices.find((d) => d.id === here.device);
  const other = devices.find((d) => d.id === there.device);
  const anchor = device && portAnchor(device, here.port, connections);
  if (!device || !other || !anchor) return null;

  const dir = anchor.side === 'right' ? 1 : -1;
  const end = { x: anchor.x + dir * STUB, y: anchor.y };
  const color = signalColor(device.ports.find((p) => p.id === here.port)?.signal_type ?? 'control');
  const outgoing = visibleEnd === 'from';
  const place = roomNameOf(rooms, other.room) || 'вне помещений';
  const text = `${outgoing ? '→' : '←'} ${place} · ${tags[other.id] ?? other.model}`;
  // Стрелка показывает направление сигнала: от порта наружу или снаружи к порту
  const points = outgoing ? [anchor.x, anchor.y, end.x, end.y] : [end.x, end.y, anchor.x + dir * 6, anchor.y];

  const handleSelect = (e: KonvaEventObject<Event>) => {
    e.cancelBubble = true;
    dispatch(selectConnection(connection.id));
  };

  return (
    <>
      <Arrow
        points={points}
        stroke={color}
        fill={color}
        strokeWidth={2.5}
        dash={[6, 4]}
        pointerLength={8}
        pointerWidth={8}
        hitStrokeWidth={14}
        listening={interactive}
        onClick={handleSelect}
        onTap={handleSelect}
      />
      <Label
        x={end.x + (dir > 0 ? 6 : -6)}
        y={end.y}
        offsetY={9}
        offsetX={dir > 0 ? 0 : text.length * 6.2 + 8}
        listening={interactive}
        onClick={handleSelect}
        onTap={handleSelect}
      >
        <Tag fill={palette.cableLabelFill} stroke={color} strokeWidth={1} cornerRadius={3} />
        <Text text={text} fontSize={11} padding={4} fill={palette.cableLabelText} />
      </Label>
    </>
  );
};

export default OffRoomStub;
