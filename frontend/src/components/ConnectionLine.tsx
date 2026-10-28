import React, { useContext } from 'react';
import { Path, Label, Tag, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Connection, Device } from '../types/device.types';
import { useAppDispatch, useAppSelector } from '../store';
import { selectConnection } from '../features/canvasSlice';
import { portAnchor, nodeSize, routeCable, roundedPath, labelPoint, signalColor, laneOffset } from './deviceGeometry';
import { CanvasRenderContext } from './canvasTheme';

interface ConnectionLineProps {
  connection: Connection;
  devices: Device[];
}

const ConnectionLine: React.FC<ConnectionLineProps> = ({ connection, devices }) => {
  const dispatch = useAppDispatch();
  const { palette, interactive, showCableLabels } = useContext(CanvasRenderContext);
  const selectedConnectionId = useAppSelector((s) => s.canvas.selectedConnectionId);
  const simulation = useAppSelector((s) => s.canvas.simulation);
  const zoom = useAppSelector((s) => s.canvas.zoom);
  const connections = useAppSelector((s) => s.canvas.connections);

  const fromDevice = devices.find((d) => d.id === connection.from.device);
  const toDevice = devices.find((d) => d.id === connection.to.device);
  if (!fromDevice || !toDevice) return null;

  const a = portAnchor(fromDevice, connection.from.port, connections);
  const b = portAnchor(toDevice, connection.to.port, connections);
  if (!a || !b) return null;

  const fromPort = fromDevice.ports.find((p) => p.id === connection.from.port);
  const cableColor = signalColor(fromPort?.signal_type || 'control');
  const isSelected = interactive && selectedConnectionId === connection.id;

  // Проблема симуляции, относящаяся к этому кабелю
  const hasError = interactive && !!simulation?.errors.some((e) => e.connection === connection.id);
  const hasWarning = interactive && !!simulation?.warnings.some((w) => w.connection === connection.id);
  const issueColor = hasError ? palette.error : hasWarning ? palette.warning : null;

  const below = Math.max(
    fromDevice.position.y + nodeSize(fromDevice, connections).height,
    toDevice.position.y + nodeSize(toDevice, connections).height
  );
  const points = routeCable(a, b, laneOffset(connection, fromDevice, toDevice, connections), below);
  const data = roundedPath(points);
  const mid = labelPoint(points);
  // Кабель A-001 · 10 м; при мелком масштабе подписи скрываем, чтобы не мешали
  const labelText = [connection.label, `${connection.cable_length} м`].filter(Boolean).join(' · ');
  const showLabel = showCableLabels && (!interactive || zoom >= 0.5);

  const handleSelect = (e: KonvaEventObject<Event>) => {
    e.cancelBubble = true;
    dispatch(selectConnection(connection.id));
  };
  const setCursor = (e: KonvaEventObject<Event>, cursor: string) => {
    const c = e.target.getStage()?.container();
    if (c) c.style.cursor = cursor;
  };

  return (
    <>
      {issueColor && (
        <Path data={data} stroke={issueColor} strokeWidth={9} opacity={0.35} lineCap="round" lineJoin="round" listening={false} />
      )}
      <Path
        data={data}
        stroke={cableColor}
        strokeWidth={isSelected ? 4 : 2.5}
        lineCap="round"
        lineJoin="round"
        dash={issueColor ? [8, 5] : undefined}
        shadowColor={isSelected ? cableColor : undefined}
        shadowBlur={isSelected ? 12 : 0}
        shadowOpacity={0.9}
        hitStrokeWidth={14}
        listening={interactive}
        onClick={handleSelect}
        onTap={handleSelect}
        onMouseEnter={(e) => setCursor(e, 'pointer')}
        onMouseLeave={(e) => setCursor(e, 'default')}
      />
      {showLabel && labelText && (
        <Label
          x={mid.x}
          y={mid.y}
          // Центрируем подпись на трассе (ширина текста — по средней ширине символа)
          offsetX={(labelText.length * 5.1 + 6) / 2}
          offsetY={7.5}
          listening={interactive}
          onClick={handleSelect}
          onTap={handleSelect}
        >
          <Tag
            fill={palette.cableLabelFill}
            stroke={isSelected ? cableColor : issueColor ?? cableColor}
            strokeWidth={1}
            cornerRadius={3}
            pointerDirection="none"
          />
          <Text text={labelText} fontSize={9} padding={3} fill={palette.cableLabelText} />
        </Label>
      )}
    </>
  );
};

export default ConnectionLine;
