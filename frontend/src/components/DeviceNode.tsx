import React, { useState } from 'react';
import { Group, Rect, Text, Circle, Label, Tag } from 'react-konva';
import { useAppDispatch, useAppSelector } from '../store';
import {
  selectDevice,
  updateDevicePosition,
  startConnection,
  completeConnection,
  cancelConnection,
  showToast,
} from '../features/canvasSlice';
import { Device, Port } from '../types/device.types';
import { deviceTypeLabel, portLabel } from '../data/labels';
import {
  NODE_W,
  NODE_H,
  PORT_R,
  inputPorts,
  outputPorts,
  portLocalX,
  signalColor,
  deviceEmoji,
} from './deviceGeometry';

interface DeviceNodeProps {
  device: Device;
}

const DeviceNode: React.FC<DeviceNodeProps> = ({ device }) => {
  const dispatch = useAppDispatch();
  const selectedDeviceId = useAppSelector((s) => s.canvas.selectedDeviceId);
  const connectionInProgress = useAppSelector((s) => s.canvas.connectionInProgress);
  const devices = useAppSelector((s) => s.canvas.devices);
  const simulation = useAppSelector((s) => s.canvas.simulation);

  const [hoverPort, setHoverPort] = useState<Port | null>(null);

  const isSelected = selectedDeviceId === device.id;
  const isConnectingFrom = connectionInProgress?.fromDeviceId === device.id;

  // Сигнал источника соединения — чтобы подсветить совместимые входы.
  let sourceSignal: string | null = null;
  if (connectionInProgress) {
    const src = devices.find((d) => d.id === connectionInProgress.fromDeviceId);
    sourceSignal = src?.ports.find((p) => p.id === connectionInProgress.fromPortId)?.signal_type ?? null;
  }

  const hasError = !!simulation?.errors.some((e) => e.device === device.id);
  const hasWarning = !!simulation?.warnings.some((w) => w.device === device.id);

  let borderColor = '#3d4654';
  if (isSelected) borderColor = '#3DDC84';
  else if (isConnectingFrom) borderColor = '#FFC107';
  else if (hasError) borderColor = '#F44336';
  else if (hasWarning) borderColor = '#FF9800';

  const accent = signalColor(device.ports[0]?.signal_type || 'control');

  const handleDragEnd = (e: any) => {
    dispatch(updateDevicePosition({ id: device.id, position: { x: e.target.x(), y: e.target.y() } }));
  };

  const handleClick = (e: any) => {
    e.cancelBubble = true;
    dispatch(selectDevice(device.id));
  };

  const handlePortClick = (port: Port, role: 'input' | 'output', e: any) => {
    e.cancelBubble = true;
    if (!connectionInProgress) {
      if (role === 'output') {
        dispatch(startConnection({ deviceId: device.id, portId: port.id }));
      } else {
        dispatch(showToast({ message: 'Начните соединение с выходного порта (снизу устройства)', severity: 'info' }));
      }
      return;
    }
    // Соединение уже начато — кликнули по второму порту
    if (role !== 'input' || device.id === connectionInProgress.fromDeviceId) {
      dispatch(cancelConnection());
      return;
    }
    if (sourceSignal && port.signal_type !== sourceSignal) {
      dispatch(showToast({ message: 'Несовместимые сигналы: эти порты нельзя соединить', severity: 'error' }));
      return;
    }
    dispatch(completeConnection({ toDeviceId: device.id, toPortId: port.id, cableType: port.type }));
    dispatch(showToast({ message: 'Соединение создано', severity: 'success' }));
  };

  const ins = inputPorts(device);
  const outs = outputPorts(device);

  const renderPort = (port: Port, role: 'input' | 'output', count: number, idx: number) => {
    const x = portLocalX(count, idx);
    const y = role === 'input' ? 0 : NODE_H;
    const compatible = role === 'input' && connectionInProgress && sourceSignal === port.signal_type;
    const incompatible = role === 'input' && connectionInProgress && sourceSignal !== port.signal_type;
    return (
      <React.Fragment key={`${role}-${port.id}`}>
        {compatible && <Circle x={x} y={y} radius={PORT_R + 4} fill="#3DDC8455" />}
        <Circle
          x={x}
          y={y}
          radius={compatible ? PORT_R + 1 : PORT_R}
          fill={signalColor(port.signal_type)}
          stroke={compatible ? '#3DDC84' : '#FFFFFF'}
          strokeWidth={compatible ? 3 : 2}
          opacity={incompatible ? 0.35 : 1}
          onClick={(e) => handlePortClick(port, role, e)}
          onTap={(e) => handlePortClick(port, role, e)}
          onMouseEnter={(e) => {
            setHoverPort(port);
            const c = e.target.getStage()?.container();
            if (c) c.style.cursor = 'crosshair';
          }}
          onMouseLeave={(e) => {
            setHoverPort(null);
            const c = e.target.getStage()?.container();
            if (c) c.style.cursor = 'default';
          }}
        />
      </React.Fragment>
    );
  };

  return (
    <Group
      x={device.position.x}
      y={device.position.y}
      draggable
      onDragStart={() => dispatch(selectDevice(device.id))}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      onTap={handleClick}
    >
      {/* Тень/подложка */}
      <Rect
        width={NODE_W}
        height={NODE_H}
        fill="#222a36"
        stroke={borderColor}
        strokeWidth={isSelected ? 3 : 2}
        cornerRadius={10}
        shadowColor="black"
        shadowBlur={isSelected ? 16 : 8}
        shadowOpacity={0.45}
        shadowOffsetY={4}
      />
      {/* Цветная полоса категории сигнала слева */}
      <Rect x={0} y={0} width={6} height={NODE_H} fill={accent} cornerRadius={[10, 0, 0, 10]} />

      {/* Иконка */}
      <Text text={deviceEmoji(device.type)} x={14} y={12} fontSize={30} />

      {/* Тип устройства */}
      <Text
        text={deviceTypeLabel(device.type)}
        x={54}
        y={14}
        width={NODE_W - 62}
        fontSize={11}
        fill="#8b95a5"
      />
      {/* Модель */}
      <Text
        text={device.model}
        x={54}
        y={28}
        width={NODE_W - 62}
        fontSize={14}
        fontStyle="bold"
        fill="#FFFFFF"
        ellipsis
        wrap="none"
      />
      {/* Производитель */}
      <Text
        text={device.manufacturer}
        x={14}
        y={NODE_H - 24}
        width={NODE_W - 20}
        fontSize={10}
        fill="#6b7686"
      />

      {/* Порты */}
      {ins.map((p, i) => renderPort(p, 'input', ins.length, i))}
      {outs.map((p, i) => renderPort(p, 'output', outs.length, i))}

      {/* Подсказка имени порта при наведении */}
      {hoverPort && (
        <Label
          x={portLocalX(
            (hoverPort.direction === 'input' || hoverPort.direction === 'bidirectional' ? ins : outs).length,
            (hoverPort.direction === 'input' || hoverPort.direction === 'bidirectional' ? ins : outs).findIndex(
              (p) => p.id === hoverPort.id
            )
          )}
          y={(hoverPort.direction === 'input' ? -10 : NODE_H + 10)}
        >
          <Tag fill="#0d1117" stroke="#3d4654" cornerRadius={4} pointerDirection={hoverPort.direction === 'input' ? 'down' : 'up'} pointerWidth={8} pointerHeight={6} />
          <Text text={portLabel(hoverPort)} fontSize={11} padding={5} fill="#e6edf3" />
        </Label>
      )}
    </Group>
  );
};

export default DeviceNode;
