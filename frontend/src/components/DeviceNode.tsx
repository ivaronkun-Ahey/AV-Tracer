import React from 'react';
import { Group, Rect, Text, Circle, Image } from 'react-konva';
import { useAppDispatch, useAppSelector } from '../store';
import {
  selectDevice,
  updateDevicePosition,
  startConnection,
  completeConnection,
  cancelConnection
} from '../features/canvasSlice';
import { Device } from '../types/device.types';
import useImage from 'use-image';

interface DeviceNodeProps {
  device: Device;
}

const DeviceNode: React.FC<DeviceNodeProps> = ({ device }) => {
  const dispatch = useAppDispatch();
  const selectedDeviceId = useAppSelector(state => state.canvas.selectedDeviceId);
  const connectionInProgress = useAppSelector(state => state.canvas.connectionInProgress);
  const isSelected = selectedDeviceId === device.id;

  const [image] = useImage(device.icon_url || '');

  const handleDragEnd = (e: any) => {
    dispatch(updateDevicePosition({
      id: device.id,
      position: {
        x: e.target.x(),
        y: e.target.y(),
      },
    }));
  };

  const handleClick = (e: any) => {
    e.cancelBubble = true;
    dispatch(selectDevice(device.id));
  };

  const handlePortClick = (port: any, e: any) => {
    e.cancelBubble = true;

    if (!connectionInProgress) {
      // Start connection
      if (port.direction === 'output') {
        dispatch(startConnection({
          deviceId: device.id,
          portId: port.id,
        }));
      }
    } else {
      // Complete or cancel connection
      if (port.direction === 'input' && device.id !== connectionInProgress.fromDeviceId) {
        // Determine cable type based on port type
        const cableType = port.type === 'xlr' ? 'xlr' : 
                         port.type === 'hdmi' ? 'hdmi' : 
                         port.type === 'rj45' ? 'cat6' : 'xlr';

        dispatch(completeConnection({
          toDeviceId: device.id,
          toPortId: port.id,
          cableType,
        }));
      } else {
        dispatch(cancelConnection());
      }
    }
  };

  // Get input and output ports
  const inputPorts = device.ports.filter(p => p.direction === 'input' || p.direction === 'bidirectional');
  const outputPorts = device.ports.filter(p => p.direction === 'output' || p.direction === 'bidirectional');

  return (
    <Group
      x={device.position.x}
      y={device.position.y}
      draggable
      onDragEnd={handleDragEnd}
      onClick={handleClick}
    >
      {/* Background card */}
      <Rect
        width={120}
        height={100}
        fill="#3A3A3A"
        stroke={isSelected ? '#00C853' : connectionInProgress?.fromDeviceId === device.id ? '#FFC107' : '#0066CC'}
        strokeWidth={2}
        cornerRadius={8}
        shadowColor="black"
        shadowBlur={10}
        shadowOpacity={0.3}
        shadowOffsetY={4}
      />

      {/* Device icon/emoji as text if no image */}
      {!image && (
        <Text
          text={getDeviceEmoji(device.type)}
          x={35}
          y={15}
          fontSize={40}
        />
      )}

      {/* Device image if available */}
      {image && (
        <Image
          image={image}
          x={35}
          y={15}
          width={50}
          height={50}
        />
      )}

      {/* Device label */}
      <Text
        text={device.model}
        x={0}
        y={70}
        width={120}
        align="center"
        fontSize={12}
        fill="#FFFFFF"
        fontStyle="600"
      />

      {/* Input ports */}
      {inputPorts.map((port, idx) => {
        const spacing = 120 / (inputPorts.length + 1);
        return (
          <Circle
            key={`input-${port.id}`}
            x={spacing * (idx + 1)}
            y={-6}
            radius={6}
            fill={getPortColor(port.signal_type)}
            stroke="#FFFFFF"
            strokeWidth={2}
            onClick={(e) => handlePortClick(port, e)}
            onMouseEnter={(e) => {
              const container = e.target.getStage()?.container();
              if (container) container.style.cursor = 'crosshair';
            }}
            onMouseLeave={(e) => {
              const container = e.target.getStage()?.container();
              if (container) container.style.cursor = 'default';
            }}
          />
        );
      })}

      {/* Output ports */}
      {outputPorts.map((port, idx) => {
        const spacing = 120 / (outputPorts.length + 1);
        return (
          <Circle
            key={`output-${port.id}`}
            x={spacing * (idx + 1)}
            y={106}
            radius={6}
            fill={getPortColor(port.signal_type)}
            stroke="#FFFFFF"
            strokeWidth={2}
            onClick={(e) => handlePortClick(port, e)}
            onMouseEnter={(e) => {
              const container = e.target.getStage()?.container();
              if (container) container.style.cursor = 'crosshair';
            }}
            onMouseLeave={(e) => {
              const container = e.target.getStage()?.container();
              if (container) container.style.cursor = 'default';
            }}
          />
        );
      })}
    </Group>
  );
};

// Helper functions
function getDeviceEmoji(type: string): string {
  const emojis: Record<string, string> = {
    microphone: '🎤',
    mixer: '🎛️',
    amplifier: '📢',
    speaker: '🔊',
    camera: '📹',
    display: '🖥️',
    projector: '📽️',
    switcher: '🔀',
    scaler: '⚡',
    network_switch: '🌐',
    controller: '🎮',
    dsp: '💠',
    array_microphone: '🎙️',
  };
  return emojis[type] || '📦';
}

function getPortColor(signalType: string): string {
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

export default DeviceNode;
