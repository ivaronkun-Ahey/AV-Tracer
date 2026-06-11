import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Stage, Layer, Line } from 'react-konva';
import { useAppSelector, useAppDispatch } from '../store';
import {
  addDevice,
  deselectAll,
  removeDevice,
  removeConnection,
  cancelConnection,
  setZoom,
  setPan,
  resetView,
  showToast,
  undo,
  redo,
} from '../features/canvasSlice';
import DeviceNode from './DeviceNode';
import ConnectionLine from './ConnectionLine';
import EmptyState from './EmptyState';
import ZoomControls from './ZoomControls';
import { Device } from '../types/device.types';
import { outputPortPos, signalColor, NODE_W, NODE_H } from './deviceGeometry';

const CanvasWorkspace: React.FC = () => {
  const dispatch = useAppDispatch();
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);

  const devices = useAppSelector((s) => s.canvas.devices);
  const connections = useAppSelector((s) => s.canvas.connections);
  const zoom = useAppSelector((s) => s.canvas.zoom);
  const pan = useAppSelector((s) => s.canvas.pan);
  const connectionInProgress = useAppSelector((s) => s.canvas.connectionInProgress);
  const selectedDeviceId = useAppSelector((s) => s.canvas.selectedDeviceId);
  const selectedConnectionId = useAppSelector((s) => s.canvas.selectedConnectionId);

  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [pointer, setPointer] = useState({ x: 0, y: 0 });

  // Размер холста под контейнер
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Клавиатура: удаление и отмена
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return; // не мешаем вводу в поля
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) dispatch(redo());
        else dispatch(undo());
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        dispatch(redo());
        return;
      }
      if (e.key === 'Escape') {
        dispatch(cancelConnection());
        dispatch(deselectAll());
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedDeviceId) {
          dispatch(removeDevice(selectedDeviceId));
          dispatch(showToast({ message: 'Устройство удалено', severity: 'info' }));
        } else if (selectedConnectionId) {
          dispatch(removeConnection(selectedConnectionId));
          dispatch(showToast({ message: 'Соединение удалено', severity: 'info' }));
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch, selectedDeviceId, selectedConnectionId]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const box = stage.container().getBoundingClientRect();
    const px = e.clientX - box.left;
    const py = e.clientY - box.top;
    // Перевод экранных координат в координаты сцены с учётом зума и панорамы
    const x = (px - stage.x()) / stage.scaleX();
    const y = (py - stage.y()) / stage.scaleY();

    const data = e.dataTransfer.getData('deviceData');
    if (!data) return;
    const tpl = JSON.parse(data);

    const newDevice: Device = {
      id: `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: tpl.type,
      manufacturer: tpl.manufacturer,
      model: tpl.model,
      full_name: tpl.full_name,
      category: tpl.category,
      position: { x: x - NODE_W / 2, y: y - NODE_H / 2 },
      properties: { ...tpl.default_properties },
      ports: tpl.ports,
      specs: tpl.specs,
    };
    dispatch(addDevice(newDevice));
  };

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const oldScale = stage.scaleX();
    const ptr = stage.getPointerPosition();
    if (!ptr) return;
    const mousePoint = {
      x: (ptr.x - stage.x()) / oldScale,
      y: (ptr.y - stage.y()) / oldScale,
    };
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = Math.max(0.2, Math.min(3, oldScale * (direction > 0 ? 1.1 : 1 / 1.1)));
    dispatch(setZoom(newScale));
    dispatch(
      setPan({
        x: ptr.x - mousePoint.x * newScale,
        y: ptr.y - mousePoint.y * newScale,
      })
    );
  };

  const handleStageMouseDown = (e: any) => {
    // Клик по пустому месту сцены — снять выделение
    if (e.target === e.target.getStage()) {
      dispatch(deselectAll());
    }
  };

  const handleStageDragEnd = (e: any) => {
    // Панорама только при перетаскивании самой сцены (не узла)
    if (e.target === e.target.getStage()) {
      dispatch(setPan({ x: e.target.x(), y: e.target.y() }));
    }
  };

  const handleMouseMove = useCallback(() => {
    const stage = stageRef.current;
    if (!stage || !connectionInProgress) return;
    const rel = stage.getRelativePointerPosition();
    if (rel) setPointer({ x: rel.x, y: rel.y });
  }, [connectionInProgress]);

  // Координаты источника для «резиновой» линии соединения
  let rubberStart: { x: number; y: number } | null = null;
  let rubberColor = '#3DDC84';
  if (connectionInProgress) {
    const src = devices.find((d) => d.id === connectionInProgress.fromDeviceId);
    if (src) {
      rubberStart = outputPortPos(src, connectionInProgress.fromPortId);
      const port = src.ports.find((p) => p.id === connectionInProgress.fromPortId);
      rubberColor = signalColor(port?.signal_type || 'control');
    }
  }

  return (
    <div
      ref={containerRef}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: '#11161f',
        backgroundImage: `linear-gradient(#1b2230 1px, transparent 1px), linear-gradient(90deg, #1b2230 1px, transparent 1px)`,
        backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
        overflow: 'hidden',
      }}
    >
      <Stage
        ref={stageRef}
        width={dimensions.width}
        height={dimensions.height}
        scaleX={zoom}
        scaleY={zoom}
        x={pan.x}
        y={pan.y}
        draggable
        onWheel={handleWheel}
        onMouseDown={handleStageMouseDown}
        onTouchStart={handleStageMouseDown}
        onDragEnd={handleStageDragEnd}
        onMouseMove={handleMouseMove}
      >
        <Layer>
          {connections.map((c) => (
            <ConnectionLine key={c.id} connection={c} devices={devices} />
          ))}

          {rubberStart && (
            <Line
              points={[rubberStart.x, rubberStart.y, pointer.x, pointer.y]}
              stroke={rubberColor}
              strokeWidth={2.5}
              dash={[8, 6]}
              listening={false}
            />
          )}

          {devices.map((d) => (
            <DeviceNode key={d.id} device={d} />
          ))}
        </Layer>
      </Stage>

      {devices.length === 0 && <EmptyState />}

      {connectionInProgress && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#1f2733',
            border: '1px solid #FFC10755',
            color: '#FFC107',
            padding: '6px 14px',
            borderRadius: 20,
            fontSize: 13,
            pointerEvents: 'none',
          }}
        >
          Выберите входной порт другого устройства · Esc — отмена
        </div>
      )}

      <ZoomControls
        zoom={zoom}
        onZoomIn={() => dispatch(setZoom(zoom * 1.2))}
        onZoomOut={() => dispatch(setZoom(zoom / 1.2))}
        onReset={() => dispatch(resetView())}
      />
    </div>
  );
};

export default CanvasWorkspace;
