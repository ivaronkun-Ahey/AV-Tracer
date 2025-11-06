import React from 'react';
import { Line, Circle } from 'react-konva';
import { Connection, Device } from '../types/device.types';

interface ConnectionLineProps {
  connection: Connection;
  devices: Device[];
}

const ConnectionLine: React.FC<ConnectionLineProps> = ({ connection, devices }) => {
  // Find from and to devices
  const fromDevice = devices.find(d => d.id === connection.from.device);
  const toDevice = devices.find(d => d.id === connection.to.device);

  if (!fromDevice || !toDevice) return null;

  // Find the port positions
  const fromPort = fromDevice.ports.find(p => p.id === connection.from.port);
  const toPort = toDevice.ports.find(p => p.id === connection.to.port);

  if (!fromPort || !toPort) return null;

  // Calculate port positions
  const fromOutputPorts = fromDevice.ports.filter(p => p.direction === 'output' || p.direction === 'bidirectional');
  const toInputPorts = toDevice.ports.filter(p => p.direction === 'input' || p.direction === 'bidirectional');

  const fromPortIndex = fromOutputPorts.findIndex(p => p.id === fromPort.id);
  const toPortIndex = toInputPorts.findIndex(p => p.id === toPort.id);

  const fromSpacing = 120 / (fromOutputPorts.length + 1);
  const toSpacing = 120 / (toInputPorts.length + 1);

  const fromX = fromDevice.position.x + fromSpacing * (fromPortIndex + 1);
  const fromY = fromDevice.position.y + 106;
  const toX = toDevice.position.x + toSpacing * (toPortIndex + 1);
  const toY = toDevice.position.y - 6;

  // Get cable color based on signal type
  const cableColor = getCableColor(fromPort.signal_type);

  // Calculate bezier control points for smooth curves
  const controlOffset = Math.abs(toY - fromY) * 0.5;

  return (
    <>
      {/* Bezier curve connection line */}
      <Line
        points={[
          fromX, fromY,
          fromX, fromY + controlOffset,
          toX, toY - controlOffset,
          toX, toY
        ]}
        stroke={cableColor}
        strokeWidth={3}
        tension={0.5}
        bezier
        shadowColor="black"
        shadowBlur={5}
        shadowOpacity={0.3}
      />

      {/* Connection point indicators */}
      <Circle
        x={fromX}
        y={fromY}
        radius={4}
        fill={cableColor}
        stroke="#FFFFFF"
        strokeWidth={1}
      />
      <Circle
        x={toX}
        y={toY}
        radius={4}
        fill={cableColor}
        stroke="#FFFFFF"
        strokeWidth={1}
      />
    </>
  );
};

function getCableColor(signalType: string): string {
  const colors: Record<string, string> = {
    analog_audio: '#FF6B00',
    digital_audio: '#0066CC',
    video: '#00B8D4',
    hdmi: '#00B8D4',
    sdi: '#00C8FF',
    network: '#00C853',
    control: '#9C27B0',
  };
  return colors[signalType] || '#0066CC';
}

export default ConnectionLine;
