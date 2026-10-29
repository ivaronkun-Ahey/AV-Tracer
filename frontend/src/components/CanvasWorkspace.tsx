import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Box, TextField } from '@mui/material';
import { Stage, Layer, Path } from 'react-konva';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useAppSelector, useAppDispatch } from '../store';
import {
  addDevice,
  deselectAll,
  removeDevice,
  removeConnection,
  cancelConnection,
  setZoom,
  setPan,
  setViewportSize,
  nudgeDevice,
  setRoomFilter,
  resetView,
  requestFit,
  showToast,
  undo,
  redo,
} from '../features/canvasSlice';
import DeviceNode from './DeviceNode';
import ConnectionLine from './ConnectionLine';
import EmptyState from './EmptyState';
import RoomFrame from './RoomFrame';
import OffRoomStub from './OffRoomStub';
import ZoomControls from './ZoomControls';
import { createDevice, findEquipment, newDeviceId } from '../data/equipment';
import { deviceTags } from '../data/deviceTags';
import {
  portAnchor,
  signalColor,
  nodeSize,
  routeCable,
  roundedPath,
  diagramBounds,
  snapToGrid,
  GRID,
} from './deviceGeometry';
import { CanvasRenderContext, DARK_PALETTE } from './canvasTheme';

const FIT_PADDING = 60;

/** Клавиши холста не должны срабатывать, пока человек вводит текст или работает в меню. */
function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable) return true;
  return !!el.closest?.('[role="menu"], [role="listbox"], [role="dialog"]');
}

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

const CanvasWorkspace: React.FC = () => {
  const dispatch = useAppDispatch();
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);

  const devices = useAppSelector((s) => s.canvas.devices);
  const connections = useAppSelector((s) => s.canvas.connections);
  const rooms = useAppSelector((s) => s.canvas.rooms);
  const roomFilter = useAppSelector((s) => s.canvas.roomFilter);
  const zoom = useAppSelector((s) => s.canvas.zoom);
  const pan = useAppSelector((s) => s.canvas.pan);
  const connectionInProgress = useAppSelector((s) => s.canvas.connectionInProgress);
  const selectedDeviceId = useAppSelector((s) => s.canvas.selectedDeviceId);
  const selectedConnectionId = useAppSelector((s) => s.canvas.selectedConnectionId);
  const snap = useAppSelector((s) => s.canvas.snapToGrid);
  const showCableLabels = useAppSelector((s) => s.canvas.showCableLabels);
  const fitRequest = useAppSelector((s) => s.canvas.fitRequest);

  const tags = useMemo(() => deviceTags(devices), [devices]);
  // Фильтр по помещению: видны его устройства; кабели наружу — обрывом с адресом
  const visibleDevices = useMemo(
    () => (roomFilter ? devices.filter((d) => d.room === roomFilter) : devices),
    [devices, roomFilter]
  );
  const visibleIds = useMemo(() => new Set(visibleDevices.map((d) => d.id)), [visibleDevices]);
  const filterRoom = rooms.find((r) => r.id === roomFilter);
  const renderContext = useMemo(
    () => ({ palette: DARK_PALETTE, interactive: true, showCableLabels }),
    [showCableLabels]
  );

  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [pointer, setPointer] = useState({ x: 0, y: 0 });

  // Размер холста под контейнер: меняется и при сворачивании панелей, не только окна
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const size = { width: el.clientWidth, height: el.clientHeight };
      setDimensions(size);
      dispatch(setViewportSize(size));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [dispatch]);

  // «Вписать в экран»: масштаб и панорама так, чтобы была видна вся схема (или помещение)
  const devicesRef = useRef(visibleDevices);
  devicesRef.current = visibleDevices;
  const connectionsRef = useRef(connections);
  connectionsRef.current = connections;
  useEffect(() => {
    if (fitRequest === 0) return;
    const bounds = diagramBounds(devicesRef.current, connectionsRef.current);
    if (!bounds) return;
    const scale = Math.max(
      0.2,
      Math.min(
        1.25,
        (dimensions.width - FIT_PADDING * 2) / bounds.width,
        (dimensions.height - FIT_PADDING * 2) / bounds.height
      )
    );
    dispatch(setZoom(scale));
    dispatch(
      setPan({
        x: dimensions.width / 2 - (bounds.x + bounds.width / 2) * scale,
        y: dimensions.height / 2 - (bounds.y + bounds.height / 2) * scale,
      })
    );
    // Реагируем только на новый запрос, а не на каждое изменение размеров
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitRequest, dispatch]);

  // Клавиатура: удаление и отмена
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return; // не мешаем вводу в поля и меню
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

    const tpl = findEquipment(e.dataTransfer.getData('equipmentId'));
    if (!tpl) return;

    const newDevice = createDevice(tpl, newDeviceId(), { x, y });
    // Центр устройства — под курсором (с привязкой к сетке)
    const size = nodeSize(newDevice);
    const pos = { x: x - size.width / 2, y: y - size.height / 2 };
    newDevice.position = snap ? { x: snapToGrid(pos.x), y: snapToGrid(pos.y) } : pos;
    dispatch(addDevice(newDevice));
  };

  // Стрелки двигают выбранное устройство, когда фокус на холсте (Shift — на 5 клеток)
  const handleCanvasKey = (e: React.KeyboardEvent) => {
    const dir = ARROWS[e.key];
    if (!dir || !selectedDeviceId || e.target !== containerRef.current) return;
    e.preventDefault();
    const step = GRID * (e.shiftKey ? 5 : 1);
    dispatch(nudgeDevice({ id: selectedDeviceId, dx: dir[0] * step, dy: dir[1] * step }));
  };

  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
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

  const handleStageMouseDown = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    // Клик по пустому месту сцены — снять выделение
    if (e.target === e.target.getStage()) {
      dispatch(deselectAll());
    }
  };

  const handleStageDragEnd = (e: KonvaEventObject<DragEvent>) => {
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

  // «Резиновая» трасса от выбранного выхода к курсору
  let rubberPath: string | null = null;
  let rubberColor = '#3DDC84';
  if (connectionInProgress) {
    const src = devices.find((d) => d.id === connectionInProgress.fromDeviceId);
    const start = src ? portAnchor(src, connectionInProgress.fromPortId, connections) : null;
    if (src && start) {
      rubberPath = roundedPath(routeCable(start, { ...pointer, side: 'left' }));
      const port = src.ports.find((p) => p.id === connectionInProgress.fromPortId);
      rubberColor = signalColor(port?.signal_type || 'control');
    }
  }

  return (
    <Box
      ref={containerRef}
      tabIndex={0}
      role="application"
      aria-label="Холст схемы. Стрелки двигают выбранное устройство, Delete удаляет, Esc снимает выделение"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onKeyDown={handleCanvasKey}
      // Konva отменяет действие mousedown по умолчанию, и фокус сам не переходит на холст
      onMouseDown={() => containerRef.current?.focus({ preventScroll: true })}
      sx={{
        '&:focus-visible': { outline: '2px solid #0066CC', outlineOffset: '-2px' },
        position: 'relative',
        width: '100%',
        height: '100%',
        background: '#11161f',
        backgroundImage: `linear-gradient(#1b2230 1px, transparent 1px), linear-gradient(90deg, #1b2230 1px, transparent 1px)`,
        backgroundSize: `${GRID * zoom}px ${GRID * zoom}px`,
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
        <CanvasRenderContext.Provider value={renderContext}>
          <Layer>
            {rooms
              .filter((r) => !roomFilter || r.id === roomFilter)
              .map((r) => (
                <RoomFrame key={r.id} room={r} devices={devices} connections={connections} />
              ))}

            {connections.map((c) => {
              const fromVisible = visibleIds.has(c.from.device);
              const toVisible = visibleIds.has(c.to.device);
              if (fromVisible && toVisible) return <ConnectionLine key={c.id} connection={c} devices={devices} />;
              if (!fromVisible && !toVisible) return null;
              return (
                <OffRoomStub
                  key={c.id}
                  connection={c}
                  visibleEnd={fromVisible ? 'from' : 'to'}
                  devices={devices}
                  connections={connections}
                  rooms={rooms}
                  tags={tags}
                />
              );
            })}

            {rubberPath && (
              <Path data={rubberPath} stroke={rubberColor} strokeWidth={2.5} dash={[8, 6]} listening={false} />
            )}

            {visibleDevices.map((d) => (
              <DeviceNode key={d.id} device={d} tag={tags[d.id]} />
            ))}
          </Layer>
        </CanvasRenderContext.Provider>
      </Stage>

      {devices.length === 0 && <EmptyState />}

      {rooms.length > 0 && (
        <Box sx={{ position: 'absolute', top: 12, left: 12, bgcolor: '#161b22', borderRadius: 1 }}>
          <TextField
            select
            size="small"
            label="Помещение"
            value={roomFilter ?? ''}
            onChange={(e) => {
              dispatch(setRoomFilter(e.target.value || null));
              dispatch(requestFit());
            }}
            SelectProps={{ native: true }}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 180 }}
          >
            <option value="">Все помещения</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </TextField>
        </Box>
      )}

      {filterRoom && visibleDevices.length === 0 && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            color: 'text.secondary',
            textAlign: 'center',
            px: 3,
          }}
        >
          В помещении «{filterRoom.name}» пока нет устройств — добавьте их из библиотеки, они попадут сюда
        </Box>
      )}

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
          Выберите вход другого устройства (порты слева) · Esc — отмена
        </div>
      )}

      <ZoomControls
        zoom={zoom}
        onZoomIn={() => dispatch(setZoom(zoom * 1.2))}
        onZoomOut={() => dispatch(setZoom(zoom / 1.2))}
        onReset={() => dispatch(resetView())}
        onFit={() => dispatch(requestFit())}
      />
    </Box>
  );
};

export default CanvasWorkspace;
