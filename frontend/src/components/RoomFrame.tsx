import React, { useContext, useRef } from 'react';
import { Group, Rect, Label, Tag, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Connection, Device, Room } from '../types/device.types';
import { useAppDispatch, useAppSelector } from '../store';
import { beginRoomDrag, moveDevicesTo, selectRoom } from '../features/canvasSlice';
import { roomBounds, snapToGrid } from './deviceGeometry';
import { CanvasRenderContext } from './canvasTheme';

interface RoomFrameProps {
  room: Room;
  devices: Device[];
  connections: Connection[];
}

/**
 * Рамка помещения вокруг его устройств. Подпись — ручка: клик выбирает
 * помещение, перетаскивание двигает все его устройства (одним шагом отмены).
 * Сама рамка клики не перехватывает — холст под ней панорамируется как обычно.
 */
const RoomFrame: React.FC<RoomFrameProps> = ({ room, devices, connections }) => {
  const dispatch = useAppDispatch();
  const { interactive } = useContext(CanvasRenderContext);
  const selectedRoomId = useAppSelector((s) => s.canvas.selectedRoomId);
  const snap = useAppSelector((s) => s.canvas.snapToGrid);
  const drag = useRef<{ x: number; y: number; origin: Record<string, { x: number; y: number }> } | null>(null);

  const bounds = roomBounds(room.id, devices, connections);
  if (!bounds) return null;
  const selected = interactive && selectedRoomId === room.id;

  const handleDragStart = (e: KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    const origin = Object.fromEntries(devices.filter((d) => d.room === room.id).map((d) => [d.id, { ...d.position }]));
    drag.current = { x: e.target.x(), y: e.target.y(), origin };
    dispatch(beginRoomDrag(room.id));
  };

  const handleDragMove = (e: KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    const start = drag.current;
    if (!start) return;
    let dx = e.target.x() - start.x;
    let dy = e.target.y() - start.y;
    if (snap) {
      dx = snapToGrid(dx);
      dy = snapToGrid(dy);
      e.target.position({ x: start.x + dx, y: start.y + dy });
    }
    const next = Object.fromEntries(Object.entries(start.origin).map(([id, p]) => [id, { x: p.x + dx, y: p.y + dy }]));
    dispatch(moveDevicesTo(next));
  };

  const handleSelect = (e: KonvaEventObject<Event>) => {
    e.cancelBubble = true;
    dispatch(selectRoom(room.id));
  };

  const setCursor = (e: KonvaEventObject<Event>, cursor: string) => {
    const c = e.target.getStage()?.container();
    if (c) c.style.cursor = cursor;
  };

  return (
    <Group>
      <Rect
        x={bounds.x}
        y={bounds.y}
        width={bounds.width}
        height={bounds.height}
        cornerRadius={10}
        stroke={room.color}
        strokeWidth={selected ? 3 : 1.5}
        dash={[10, 6]}
        fill={`${room.color}14`}
        listening={false}
      />
      <Label
        x={bounds.x}
        y={bounds.y}
        draggable={interactive}
        listening={interactive}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={(e) => {
          e.cancelBubble = true;
          drag.current = null;
        }}
        onClick={handleSelect}
        onTap={handleSelect}
        onMouseEnter={(e) => setCursor(e, 'move')}
        onMouseLeave={(e) => setCursor(e, 'default')}
      >
        <Tag fill={room.color} cornerRadius={[10, 0, 8, 0]} />
        <Text text={room.name} fontSize={13} fontStyle="bold" padding={6} fill="#ffffff" />
      </Label>
    </Group>
  );
};

export default RoomFrame;
