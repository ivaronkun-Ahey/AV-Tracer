import React, { useRef, useEffect, useState } from 'react';
import { Stage, Layer } from 'react-konva';
import { useAppSelector, useAppDispatch } from '../store';
import { addDevice } from '../features/canvasSlice';
import DeviceNode from './DeviceNode';
import ConnectionLine from './ConnectionLine';
import { Device } from '../types/device.types';

const CanvasWorkspace: React.FC = () => {
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { width, height } = dimensions;
  const devices = useAppSelector(state => state.canvas.devices);
  const connections = useAppSelector(state => state.canvas.connections);
  const dispatch = useAppDispatch();
  const stageRef = useRef<any>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    // Get pointer position relative to stage
    const pointerPosition = stage.getPointerPosition();
    
    // Get dropped device data
    const deviceData = e.dataTransfer.getData('deviceData');
    if (!deviceData) return;

    const parsedDevice = JSON.parse(deviceData);

    // Create new device
    const newDevice: Device = {
      id: `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: parsedDevice.type,
      manufacturer: parsedDevice.manufacturer,
      model: parsedDevice.model,
      full_name: parsedDevice.full_name,
      category: parsedDevice.category,
      position: {
        x: pointerPosition.x,
        y: pointerPosition.y,
      },
      properties: { ...parsedDevice.default_properties },
      ports: parsedDevice.ports,
      icon_url: parsedDevice.icon_url,
      image_url: parsedDevice.image_url,
    };

    dispatch(addDevice(newDevice));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      style={{
        width: '100%',
        height: '100%',
        background: '#1E1E1E',
        backgroundImage: `
          linear-gradient(#2a2a2a 1px, transparent 1px),
          linear-gradient(90deg, #2a2a2a 1px, transparent 1px)
        `,
        backgroundSize: '20px 20px',
      }}
    >
      <Stage
        ref={stageRef}
        width={width}
        height={height}
      >
        <Layer>
          {/* Render connections first (below devices) */}
          {connections.map(connection => (
            <ConnectionLine
              key={connection.id}
              connection={connection}
              devices={devices}
            />
          ))}

          {/* Render devices */}
          {devices.map(device => (
            <DeviceNode
              key={device.id}
              device={device}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
};

export default CanvasWorkspace;
