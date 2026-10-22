import React from 'react';
import { Line, Circle } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Connection, Device } from '../types/device.types';
import { useAppDispatch, useAppSelector } from '../store';
import { selectConnection } from '../features/canvasSlice';
import { outputPortPos, inputPortPos, signalColor } from './deviceGeometry';

interface ConnectionLineProps {
  connection: Connection;
  devices: Device[];
}

const ConnectionLine: React.FC<ConnectionLineProps> = ({ connection, devices }) => {
  const dispatch = useAppDispatch();
  const selectedConnectionId = useAppSelector((s) => s.canvas.selectedConnectionId);

  const fromDevice = devices.find((d) => d.id === connection.from.device);
  const toDevice = devices.find((d) => d.id === connection.to.device);
  if (!fromDevice || !toDevice) return null;

  const fromPos = outputPortPos(fromDevice, connection.from.port);
  const toPos = inputPortPos(toDevice, connection.to.port);
  if (!fromPos || !toPos) return null;

  const fromPort = fromDevice.ports.find((p) => p.id === connection.from.port);
  const cableColor = signalColor(fromPort?.signal_type || 'control');
  const isSelected = selectedConnectionId === connection.id;

  const controlOffset = Math.max(40, Math.abs(toPos.y - fromPos.y) * 0.5);

  const points = [
    fromPos.x, fromPos.y,
    fromPos.x, fromPos.y + controlOffset,
    toPos.x, toPos.y - controlOffset,
    toPos.x, toPos.y,
  ];

  const handleSelect = (e: KonvaEventObject<Event>) => {
    e.cancelBubble = true;
    dispatch(selectConnection(connection.id));
  };

  return (
    <>
      {/* Широкая невидимая линия — увеличенная область клика */}
      <Line
        points={points}
        stroke="transparent"
        strokeWidth={16}
        tension={0.5}
        bezier
        onClick={handleSelect}
        onTap={handleSelect}
        onMouseEnter={(e) => {
          const c = e.target.getStage()?.container();
          if (c) c.style.cursor = 'pointer';
        }}
        onMouseLeave={(e) => {
          const c = e.target.getStage()?.container();
          if (c) c.style.cursor = 'default';
        }}
      />
      <Line
        points={points}
        stroke={cableColor}
        strokeWidth={isSelected ? 5 : 3}
        tension={0.5}
        bezier
        shadowColor={isSelected ? cableColor : 'black'}
        shadowBlur={isSelected ? 12 : 4}
        shadowOpacity={isSelected ? 0.9 : 0.3}
        listening={false}
      />
      <Circle x={fromPos.x} y={fromPos.y} radius={4} fill={cableColor} stroke="#FFFFFF" strokeWidth={1} listening={false} />
      <Circle x={toPos.x} y={toPos.y} radius={4} fill={cableColor} stroke="#FFFFFF" strokeWidth={1} listening={false} />
    </>
  );
};

export default ConnectionLine;
