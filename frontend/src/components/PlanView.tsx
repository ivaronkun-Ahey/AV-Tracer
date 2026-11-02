import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  TextField,
  Stack,
  IconButton,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import StraightenIcon from '@mui/icons-material/Straighten';
import { useAppDispatch, useAppSelector } from '../store';
import {
  addRoom,
  beginPlanDrag,
  movePlanTo,
  placeOnPlan,
  removeFromPlan,
  selectDevice,
  setConnectionLengths,
  setRoomSize,
  showToast,
} from '../features/canvasSlice';
import { cableLengthsFromPlan, freeSpot, validSize } from '../data/plan';
import { newRoomId, nextRoomColor, nextRoomName } from '../data/rooms';
import { deviceTypeLabel } from '../data/labels';
import { Device, Room } from '../types/device.types';
import { categoryColor } from './deviceGeometry';
import { ICON_VIEWBOX, deviceIconPath } from './deviceIcons';

const DRAG_TYPE = 'application/x-av-device';

/** Условная зона охвата: АС — сектор по углу раскрытия, потолочный громкоговоритель — круг, камера — угол обзора. */
function coverage(d: Device, diagonal: number): { angle: number; radius: number } | null {
  if (d.type === 'camera' || d.type === 'video_bar') return { angle: 60, radius: Math.min(10, diagonal * 0.5) };
  if (d.type !== 'speaker') return null;
  if (/потолоч/i.test(d.model)) return { angle: 360, radius: 3 };
  const angle = typeof d.properties.coverage_angle === 'number' ? d.properties.coverage_angle : 90;
  return { angle, radius: Math.min(15, diagonal * 0.6) };
}

/** Сектор с вершиной в (0, 0), направленный по углу rotation (0 — вниз по плану, 90 — вправо). */
function wedge(rotation: number, angle: number, radius: number): string {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const point = (deg: number) => `${(Math.sin(rad(deg)) * radius).toFixed(3)} ${(Math.cos(rad(deg)) * radius).toFixed(3)}`;
  const a = rotation - angle / 2;
  const b = rotation + angle / 2;
  return `M0 0 L${point(a)} A${radius} ${radius} 0 ${angle > 180 ? 1 : 0} 0 ${point(b)} Z`;
}

/** Размер помещения: ширина и длина, м — применяются по Enter или при уходе из поля. */
const SizeField: React.FC<{ label: string; value: number | undefined; onCommit: (v: number) => void }> = ({ label, value, onCommit }) => {
  const [text, setText] = useState(value === undefined ? '' : String(value));
  useEffect(() => setText(value === undefined ? '' : String(value)), [value]);
  const commit = () => {
    const v = Number(text.replace(',', '.'));
    if (Number.isFinite(v) && v > 0 && v !== value) onCommit(v);
    else setText(value === undefined ? '' : String(value));
  };
  return (
    <TextField
      size="small"
      label={label}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
      inputProps={{ inputMode: 'decimal' }}
      sx={{ flex: 1 }}
    />
  );
};

const Marker: React.FC<{
  device: Device;
  selected: boolean;
  scale: number;
  diagonal: number;
  toPlan: (e: React.PointerEvent | React.DragEvent) => { x: number; y: number } | null;
}> = ({ device, selected, scale, diagonal, toPlan }) => {
  const dispatch = useAppDispatch();
  const dragging = useRef(false);
  const place = device.plan!;
  const rotation = place.rotation ?? 0;
  const zone = coverage(device, diagonal);
  const r = 0.35 * scale;
  const iconScale = (r * 1.2) / ICON_VIEWBOX;
  const nudge = (dx: number, dy: number, rot = 0) =>
    dispatch(
      placeOnPlan({ id: device.id, x: place.x + dx, y: place.y + dy, rotation: rotation + rot, historyKey: `plan-nudge:${device.id}` })
    );

  return (
    <g
      transform={`translate(${place.x} ${place.y})`}
      role="button"
      tabIndex={0}
      aria-label={`${device.tag ?? device.model} на плане: ${place.x} × ${place.y} м${rotation ? `, направление ${rotation}°` : ''}. Стрелки — сдвиг, R — повернуть, Delete — убрать с плана`}
      style={{ cursor: 'grab', outline: 'none' }}
      onPointerDown={(e) => {
        e.preventDefault();
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        dragging.current = true;
        dispatch(beginPlanDrag(device.id));
      }}
      onPointerMove={(e) => {
        if (!dragging.current) return;
        const p = toPlan(e);
        if (p) dispatch(movePlanTo({ id: device.id, ...p }));
      }}
      onPointerUp={(e) => {
        dragging.current = false;
        (e.currentTarget as Element).releasePointerCapture(e.pointerId);
      }}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 1 : 0.1;
        const keys: Record<string, [number, number]> = {
          ArrowLeft: [-step, 0],
          ArrowRight: [step, 0],
          ArrowUp: [0, -step],
          ArrowDown: [0, step],
        };
        if (keys[e.key]) {
          e.preventDefault();
          nudge(...keys[e.key]);
        } else if (e.key === 'r' || e.key === 'R' || e.key === 'к' || e.key === 'К') {
          e.preventDefault();
          nudge(0, 0, e.shiftKey ? -45 : 45);
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          e.stopPropagation();
          dispatch(removeFromPlan(device.id));
        }
      }}
      onFocus={() => dispatch(selectDevice(device.id))}
    >
      <circle
        r={r}
        fill={categoryColor(device.category)}
        stroke={selected ? '#ffffff' : '#0d1117'}
        strokeWidth={(selected ? 0.12 : 0.05) * scale}
      />
      <path d={deviceIconPath(device.type)} fill="#ffffff" transform={`translate(${-r * 0.6} ${-r * 0.6}) scale(${iconScale})`} />
      {zone && zone.angle < 360 && (
        <line
          x1={0}
          y1={0}
          x2={Math.sin((rotation * Math.PI) / 180) * r * 1.8}
          y2={Math.cos((rotation * Math.PI) / 180) * r * 1.8}
          stroke="#ffffff"
          strokeWidth={0.06 * scale}
        />
      )}
      <text y={r + 0.45 * scale} textAnchor="middle" fontSize={0.38 * scale} fill="#e6edf3" style={{ pointerEvents: 'none' }}>
        {device.tag ?? device.model}
      </text>
    </g>
  );
};

/**
 * Вид «План»: размещение устройств помещения по реальным размерам. Размеры
 * помещения — в метрах; зоны охвата колонок и камер — условные. Длины кабелей
 * можно пересчитать по плану (по проекциям, с запасом 2 м на опуски).
 */
const PlanView: React.FC = () => {
  const dispatch = useAppDispatch();
  const devices = useAppSelector((s) => s.canvas.devices);
  const connections = useAppSelector((s) => s.canvas.connections);
  const rooms = useAppSelector((s) => s.canvas.rooms);
  const roomFilter = useAppSelector((s) => s.canvas.roomFilter);
  const selectedId = useAppSelector((s) => s.canvas.selectedDeviceId);
  const [roomId, setRoomId] = useState<string | null>(roomFilter ?? rooms[0]?.id ?? null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!roomId || !rooms.some((r) => r.id === roomId)) setRoomId(roomFilter ?? rooms[0]?.id ?? null);
  }, [rooms, roomId, roomFilter]);

  const room: Room | undefined = rooms.find((r) => r.id === roomId);
  const size = room?.size;
  const inRoom = devices.filter((d) => room && d.room === room.id);
  const placed = inRoom.filter((d) => d.plan);
  const loose = inRoom.filter((d) => !d.plan);
  const diagonal = size ? Math.hypot(size.width, size.length) : 1;
  // Размер подписей и маркеров растёт с помещением, чтобы оставаться читаемым
  const scale = size ? Math.max(1, Math.max(size.width, size.length) / 20) : 1;

  const toPlan = (e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  const createRoom = () => {
    const r: Room = { id: newRoomId(), name: nextRoomName(rooms), color: nextRoomColor(rooms), size: { width: 10, length: 8 } };
    dispatch(addRoom(r));
    setRoomId(r.id);
  };

  const lengthsFromPlan = () => {
    const lengths = cableLengthsFromPlan(devices, connections);
    const changed = connections.filter((c) => lengths[c.id] !== undefined && lengths[c.id] !== c.cable_length).length;
    if (Object.keys(lengths).length === 0) {
      dispatch(showToast({ message: 'Нет кабелей, у которых оба конца стоят на плане одного помещения', severity: 'info' }));
      return;
    }
    dispatch(setConnectionLengths(lengths));
    dispatch(
      showToast({
        message: changed ? `Длины по плану: обновлено кабелей — ${changed} · Ctrl+Z — отменить` : 'Длины кабелей уже совпадают с планом',
        severity: 'success',
      })
    );
  };

  const grid: React.ReactNode[] = [];
  if (size) {
    const step = Math.max(1, Math.round(Math.max(size.width, size.length) / 40));
    for (let x = step; x < size.width; x += step) {
      grid.push(
        <line key={`x${x}`} x1={x} y1={0} x2={x} y2={size.length} stroke="#21262d" strokeWidth={(x % (step * 5) ? 0.02 : 0.05) * scale} />
      );
    }
    for (let y = step; y < size.length; y += step) {
      grid.push(
        <line key={`y${y}`} x1={0} y1={y} x2={size.width} y2={y} stroke="#21262d" strokeWidth={(y % (step * 5) ? 0.02 : 0.05) * scale} />
      );
    }
  }
  const pad = 1.6 * scale;

  return (
    <Box role="region" aria-label="План помещения" sx={{ position: 'absolute', inset: 0, zIndex: 5, display: 'flex', bgcolor: '#0d1117' }}>
      <Box sx={{ width: 260, flexShrink: 0, borderRight: '1px solid #30363d', p: 1.5, overflow: 'auto' }}>
        {rooms.length === 0 ? (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              План строится для помещения: создайте помещение, задайте его размеры и расставьте устройства.
            </Typography>
            <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={createRoom}>
              Создать помещение
            </Button>
          </>
        ) : (
          <>
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                select
                size="small"
                fullWidth
                label="Помещение"
                value={roomId ?? ''}
                onChange={(e) => setRoomId(e.target.value)}
                SelectProps={{ native: true }}
                InputLabelProps={{ shrink: true }}
              >
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </TextField>
              <Tooltip title="Новое помещение">
                <IconButton size="small" aria-label="Новое помещение" onClick={createRoom}>
                  <AddIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
            {room && (
              <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                <SizeField
                  label="Ширина, м"
                  value={size?.width}
                  onCommit={(width) => dispatch(setRoomSize({ id: room.id, size: { width, length: size?.length ?? width } }))}
                />
                <SizeField
                  label="Длина, м"
                  value={size?.length}
                  onCommit={(length) => dispatch(setRoomSize({ id: room.id, size: { width: size?.width ?? length, length } }))}
                />
              </Stack>
            )}
            <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Не на плане
            </Typography>
            {loose.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ my: 1 }}>
                {inRoom.length === 0
                  ? 'В этом помещении нет устройств — выберите помещение в свойствах устройства.'
                  : 'Все устройства помещения стоят на плане.'}
              </Typography>
            ) : (
              <List dense aria-label="Устройства не на плане">
                {loose.map((d) => (
                  <ListItem
                    key={d.id}
                    disablePadding
                    secondaryAction={
                      <Button
                        size="small"
                        disabled={!validSize(size)}
                        onClick={() =>
                          size &&
                          dispatch(
                            placeOnPlan({
                              id: d.id,
                              ...freeSpot(
                                size,
                                placed.map((x) => x.plan!)
                              ),
                            })
                          )
                        }
                      >
                        На план
                      </Button>
                    }
                    sx={{ '& > .MuiListItemButton-root': { pr: 11 } }}
                  >
                    <ListItemButton
                      draggable={validSize(size)}
                      selected={d.id === selectedId}
                      onDragStart={(e) => e.dataTransfer.setData(DRAG_TYPE, d.id)}
                      onClick={() => dispatch(selectDevice(d.id))}
                      sx={{ borderRadius: 1 }}
                    >
                      <ListItemText primary={`${d.tag ?? ''} · ${d.model}`.replace(/^ · /, '')} secondary={deviceTypeLabel(d.type)} />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            )}
            <Button size="small" variant="outlined" startIcon={<StraightenIcon />} sx={{ mt: 1.5 }} onClick={lengthsFromPlan}>
              Длины кабелей по плану
            </Button>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.5 }}>
              Перетащите устройство на план или нажмите «На план». На плане: стрелки — сдвиг на 0,1 м (с Shift — на 1 м), R — повернуть на
              45°, Delete — убрать с плана. Длина кабеля по плану — по проекциям (вдоль стен) плюс 2 м на опуски; кабели между помещениями
              не пересчитываются. Зоны охвата колонок и камер — условные.
            </Typography>
          </>
        )}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0, p: 2, display: 'flex' }}>
        {room && size ? (
          <svg
            ref={svgRef}
            role="img"
            aria-label={`План «${room.name}»: ${size.width} × ${size.length} м`}
            viewBox={`${-pad} ${-pad} ${size.width + pad * 2} ${size.length + pad * 2}`}
            style={{ width: '100%', height: '100%', touchAction: 'none' }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData(DRAG_TYPE);
              const p = toPlan(e);
              if (id && p) dispatch(placeOnPlan({ id, ...p }));
            }}
          >
            <rect x={0} y={0} width={size.width} height={size.length} fill="#161b22" />
            {grid}
            <rect x={0} y={0} width={size.width} height={size.length} fill="none" stroke="#8b949e" strokeWidth={0.12 * scale} />
            <text x={size.width / 2} y={-0.5 * scale} textAnchor="middle" fontSize={0.5 * scale} fill="#8b949e">
              {String(size.width).replace('.', ',')} м
            </text>
            <text
              x={-0.5 * scale}
              y={size.length / 2}
              textAnchor="middle"
              fontSize={0.5 * scale}
              fill="#8b949e"
              transform={`rotate(-90 ${-0.5 * scale} ${size.length / 2})`}
            >
              {String(size.length).replace('.', ',')} м
            </text>
            <defs>
              <clipPath id="plan-room-clip">
                <rect x={0} y={0} width={size.width} height={size.length} />
              </clipPath>
            </defs>
            {/* Условные зоны охвата — под маркерами и в пределах помещения */}
            <g clipPath="url(#plan-room-clip)" style={{ pointerEvents: 'none' }}>
              {placed.map((d) => {
                const zone = coverage(d, diagonal);
                if (!zone) return null;
                const rotation = d.plan!.rotation ?? 0;
                return (
                  <g key={d.id} transform={`translate(${d.plan!.x} ${d.plan!.y})`}>
                    {zone.angle >= 360 ? (
                      <circle
                        r={zone.radius}
                        fill="#58a6ff"
                        fillOpacity={0.08}
                        stroke="#58a6ff"
                        strokeOpacity={0.35}
                        strokeWidth={0.03 * scale}
                      />
                    ) : (
                      <path
                        d={wedge(rotation, zone.angle, zone.radius)}
                        fill="#58a6ff"
                        fillOpacity={0.08}
                        stroke="#58a6ff"
                        strokeOpacity={0.35}
                        strokeWidth={0.03 * scale}
                      />
                    )}
                  </g>
                );
              })}
            </g>
            {placed.map((d) => (
              <Marker key={d.id} device={d} selected={d.id === selectedId} scale={scale} diagonal={diagonal} toPlan={toPlan} />
            ))}
          </svg>
        ) : (
          room && (
            <Typography color="text.secondary" sx={{ m: 'auto', textAlign: 'center', maxWidth: 360 }}>
              Задайте ширину и длину помещения «{room.name}» — слева, в метрах.
            </Typography>
          )
        )}
      </Box>
    </Box>
  );
};

export default PlanView;
