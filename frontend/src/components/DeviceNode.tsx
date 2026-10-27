import React, { useContext } from 'react';
import { Group, Rect, Text, Circle, Path } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useAppDispatch, useAppSelector } from '../store';
import {
  selectDevice,
  beginDeviceDrag,
  moveDevice,
  startConnection,
  completeConnection,
  cancelConnection,
  showToast,
} from '../features/canvasSlice';
import { isPortBusy } from '../features/connectionRules';
import { Device, Port } from '../types/device.types';
import { deviceTypeLabel, portLabel } from '../data/labels';
import {
  NODE_W,
  HEADER_H,
  ROW_H,
  PORT_R,
  PortSlot,
  nodeSize,
  portSlots,
  slotOffset,
  signalColor,
  signalsCompatible,
  snapToGrid,
  categoryColor,
} from './deviceGeometry';
import { deviceIconPath, ICON_VIEWBOX } from './deviceIcons';
import { CanvasRenderContext } from './canvasTheme';
import { routingMode, selectedInput } from '../sim/signalPaths';

interface DeviceNodeProps {
  device: Device;
  /** Позиционное обозначение (MIC-01). */
  tag?: string;
}

type KonvaPointerEvent = KonvaEventObject<Event>;

const ICON_SIZE = 22;

const DeviceNode: React.FC<DeviceNodeProps> = ({ device, tag }) => {
  const dispatch = useAppDispatch();
  const { palette, interactive } = useContext(CanvasRenderContext);
  const selectedDeviceId = useAppSelector((s) => s.canvas.selectedDeviceId);
  const connectionInProgress = useAppSelector((s) => s.canvas.connectionInProgress);
  const devices = useAppSelector((s) => s.canvas.devices);
  const connections = useAppSelector((s) => s.canvas.connections);
  const simulation = useAppSelector((s) => s.canvas.simulation);
  const snap = useAppSelector((s) => s.canvas.snapToGrid);

  const { width, height } = nodeSize(device, connections);
  const slots = portSlots(device, connections);
  const connecting = interactive ? connectionInProgress : null;

  // Сигнал источника соединения — чтобы подсветить совместимые входы.
  let sourceSignal: string | null = null;
  if (connecting) {
    const src = devices.find((d) => d.id === connecting.fromDeviceId);
    sourceSignal = src?.ports.find((p) => p.id === connecting.fromPortId)?.signal_type ?? null;
  }

  let borderColor = palette.nodeStroke;
  if (interactive) {
    if (selectedDeviceId === device.id) borderColor = palette.selection;
    else if (connecting?.fromDeviceId === device.id) borderColor = palette.connecting;
    else if (simulation?.errors.some((e) => e.device === device.id)) borderColor = palette.error;
    else if (simulation?.warnings.some((w) => w.device === device.id)) borderColor = palette.warning;
  }
  const isSelected = interactive && selectedDeviceId === device.id;
  const accent = categoryColor(device.category);

  const isConnected = (port: Port) =>
    connections.some(
      (c) => (c.from.device === device.id && c.from.port === port.id) || (c.to.device === device.id && c.to.port === port.id)
    );

  /** Роль порта в текущем клике: двунаправленный порт начинает или завершает соединение. */
  const roleOf = (port: Port): 'input' | 'output' =>
    port.direction === 'bidirectional' ? (connecting ? 'input' : 'output') : port.direction === 'input' ? 'input' : 'output';

  const dragPosition = (e: KonvaEventObject<DragEvent>) => {
    if (snap) e.target.position({ x: snapToGrid(e.target.x()), y: snapToGrid(e.target.y()) });
    return { id: device.id, position: { x: e.target.x(), y: e.target.y() } };
  };

  const handleClick = (e: KonvaPointerEvent) => {
    e.cancelBubble = true;
    dispatch(selectDevice(device.id));
  };

  const handlePortClick = (port: Port, e: KonvaPointerEvent) => {
    e.cancelBubble = true;
    const role = roleOf(port);
    const busy = isPortBusy(connections, device.id, port);
    if (!connecting) {
      if (role === 'input') {
        dispatch(showToast({ message: 'Начните соединение с выхода (порты справа)', severity: 'info' }));
      } else if (busy) {
        dispatch(showToast({ message: 'Этот порт уже занят кабелем', severity: 'warning' }));
      } else {
        dispatch(startConnection({ deviceId: device.id, portId: port.id }));
      }
      return;
    }
    // Соединение уже начато — кликнули по второму порту
    if (role !== 'input' || device.id === connecting.fromDeviceId) {
      dispatch(cancelConnection());
      return;
    }
    if (sourceSignal && !signalsCompatible(sourceSignal, port.signal_type)) {
      dispatch(showToast({ message: 'Несовместимые сигналы: эти порты нельзя соединить', severity: 'error' }));
      return;
    }
    if (busy) {
      dispatch(showToast({ message: 'Вход уже занят — сначала удалите подключённый кабель', severity: 'warning' }));
      return;
    }
    dispatch(completeConnection({ toDeviceId: device.id, toPortId: port.id, cableType: port.type }));
    dispatch(showToast({ message: 'Соединение создано', severity: 'success' }));
  };

  const setCursor = (e: KonvaPointerEvent, cursor: string) => {
    const c = e.target.getStage()?.container();
    if (c) c.style.cursor = cursor;
  };

  // У презентационного коммутатора выбранный вход выделен — видно, что идёт на выход
  const selectedPortId =
    routingMode(device) === 'select'
      ? device.ports.filter((p) => p.direction === 'input')[selectedInput(device) - 1]?.id
      : undefined;

  const renderSlot = (slot: PortSlot) => {
    const { port, side } = slot;
    const { x, y } = slotOffset(slot);
    const color = signalColor(port.signal_type);
    const targetable = !!connecting && roleOf(port) === 'input' && connecting.fromDeviceId !== device.id;
    const compatible =
      targetable &&
      !!sourceSignal &&
      signalsCompatible(sourceSignal, port.signal_type) &&
      !isPortBusy(connections, device.id, port);
    const dimmed = !!connecting && connecting.fromDeviceId !== device.id && !compatible;
    const handlers = interactive
      ? {
          onClick: (e: KonvaPointerEvent) => handlePortClick(port, e),
          onTap: (e: KonvaPointerEvent) => handlePortClick(port, e),
          onMouseEnter: (e: KonvaPointerEvent) => setCursor(e, 'crosshair'),
          onMouseLeave: (e: KonvaPointerEvent) => setCursor(e, 'default'),
        }
      : {};
    const labelWidth = NODE_W / 2 - 14;
    return (
      <Group key={`${side}-${port.id}`} opacity={dimmed ? 0.35 : 1}>
        {/* Вся строка порта — область клика */}
        <Rect
          x={side === 'left' ? 0 : NODE_W / 2}
          y={y - ROW_H / 2}
          width={NODE_W / 2}
          height={ROW_H}
          fill={compatible ? '#3DDC8422' : 'transparent'}
          {...handlers}
        />
        <Text
          text={port.id === selectedPortId ? `▶ ${portLabel(port)}` : portLabel(port)}
          x={side === 'left' ? 10 : NODE_W / 2 + 4}
          y={y - 5}
          width={labelWidth}
          align={side === 'left' ? 'left' : 'right'}
          fontSize={10}
          fontStyle={port.id === selectedPortId ? 'bold' : 'normal'}
          fill={port.id === selectedPortId ? palette.selection : palette.portLabel}
          ellipsis
          wrap="none"
          listening={false}
        />
        {compatible && <Circle x={x} y={y} radius={PORT_R + 4} fill="#3DDC8455" listening={false} />}
        <Circle
          x={x}
          y={y}
          radius={PORT_R}
          fill={isConnected(port) ? color : palette.nodeFill}
          stroke={compatible ? '#3DDC84' : color}
          strokeWidth={compatible ? 2.5 : 2}
          hitStrokeWidth={12}
          {...handlers}
        />
      </Group>
    );
  };

  const typeLine = `${deviceTypeLabel(device.type)} · ${device.manufacturer}`;

  return (
    <Group
      x={device.position.x}
      y={device.position.y}
      draggable={interactive}
      listening={interactive}
      onDragStart={() => dispatch(beginDeviceDrag(device.id))}
      onDragMove={(e) => dispatch(moveDevice(dragPosition(e)))}
      onDragEnd={(e) => dispatch(moveDevice(dragPosition(e)))}
      onClick={handleClick}
      onTap={handleClick}
    >
      <Rect
        width={width}
        height={height}
        fill={palette.nodeFill}
        stroke={borderColor}
        strokeWidth={isSelected ? 2.5 : 1.5}
        cornerRadius={8}
        shadowColor="black"
        shadowBlur={interactive ? (isSelected ? 16 : 8) : 0}
        shadowOpacity={0.35}
        shadowOffsetY={3}
      />
      <Rect width={width} height={HEADER_H} fill={palette.headerFill} cornerRadius={[8, 8, 0, 0]} listening={false} />
      <Rect width={width} height={3} fill={accent} cornerRadius={[8, 8, 0, 0]} listening={false} />
      <Path
        data={deviceIconPath(device.type)}
        x={10}
        y={(HEADER_H - ICON_SIZE) / 2 + 1}
        scaleX={ICON_SIZE / ICON_VIEWBOX}
        scaleY={ICON_SIZE / ICON_VIEWBOX}
        fill={accent}
        listening={false}
      />
      <Text
        text={typeLine}
        x={40}
        y={8}
        width={width - 40 - (tag ? 58 : 8)}
        fontSize={10}
        fill={palette.subtitle}
        ellipsis
        wrap="none"
        listening={false}
      />
      {tag && (
        <Text
          text={tag}
          x={width - 62}
          y={8}
          width={54}
          align="right"
          fontSize={10}
          fontStyle="bold"
          fill={palette.tag}
          listening={false}
        />
      )}
      <Text
        text={device.model}
        x={40}
        y={21}
        width={width - 48}
        fontSize={13}
        fontStyle="bold"
        fill={palette.title}
        ellipsis
        wrap="none"
        listening={false}
      />
      {slots.map(renderSlot)}
    </Group>
  );
};

export default DeviceNode;
