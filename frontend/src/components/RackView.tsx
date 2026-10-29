import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Tooltip,
  List,
  ListItemButton,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useAppDispatch, useAppSelector } from '../store';
import { addRack, placeInRack, removeFromRack, removeRack, selectDevice, setRoomFilter, updateRack } from '../features/canvasSlice';
import { DEFAULT_RACK_UNITS, rackUnits, usedUnits } from '../data/racks';
import { DEVICE_TYPE_LABELS } from '../data/labels';
import { Device, Rack } from '../types/device.types';

/** Высота юнита на экране, px. */
const ROW = 22;
const RACK_SIZES = [6, 9, 12, 15, 18, 22, 24, 27, 32, 37, 42, 47];
const DRAG_TYPE = 'application/x-av-device';

const label = (d: Device) => `${d.tag ?? ''} · ${d.model}`.replace(/^ · /, '');

/** Шкаф: создание и правка — название, высота, помещение. */
const RackDialog: React.FC<{ rack: Rack | null; open: boolean; onClose: () => void }> = ({ rack, open, onClose }) => {
  const dispatch = useAppDispatch();
  const racks = useAppSelector((s) => s.canvas.racks);
  const rooms = useAppSelector((s) => s.canvas.rooms);
  const roomFilter = useAppSelector((s) => s.canvas.roomFilter);
  const [name, setName] = useState('');
  const [units, setUnits] = useState(DEFAULT_RACK_UNITS);
  const [room, setRoom] = useState('');

  const reset = () => {
    setName(rack?.name ?? `Шкаф ${racks.length + 1}`);
    setUnits(rack?.units ?? DEFAULT_RACK_UNITS);
    setRoom(rack?.room ?? roomFilter ?? '');
  };

  const save = () => {
    if (!name.trim()) return;
    if (rack) dispatch(updateRack({ id: rack.id, name, units, room: room || null }));
    else dispatch(addRack({ id: `rack_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, name, units, ...(room ? { room } : {}) }));
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} TransitionProps={{ onEnter: reset }} maxWidth="xs" fullWidth>
      <DialogTitle>{rack ? 'Шкаф' : 'Новый шкаф'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            size="small"
            label="Название"
            value={name}
            onChange={(e) => setName(e.target.value)}
            inputProps={{ maxLength: 64 }}
            autoFocus
          />
          <TextField
            select
            size="small"
            label="Высота"
            value={units}
            onChange={(e) => setUnits(Number(e.target.value))}
            SelectProps={{ native: true }}
            InputLabelProps={{ shrink: true }}
          >
            {[...new Set([...RACK_SIZES, units])]
              .sort((a, b) => a - b)
              .map((u) => (
                <option key={u} value={u}>
                  {u}U
                </option>
              ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Помещение"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            SelectProps={{ native: true }}
            InputLabelProps={{ shrink: true }}
            helperText="Оборудование в шкафу получает его помещение"
          >
            <option value="">— без помещения —</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Отмена</Button>
        <Button variant="contained" onClick={save} disabled={!name.trim()}>
          {rack ? 'Сохранить' : 'Добавить'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const RackColumn: React.FC<{ rack: Rack; dragging: string | null; setDragging: (id: string | null) => void; onEdit: () => void }> = ({
  rack,
  dragging,
  setDragging,
  onEdit,
}) => {
  const dispatch = useAppDispatch();
  const devices = useAppSelector((s) => s.canvas.devices);
  const rooms = useAppSelector((s) => s.canvas.rooms);
  const selectedId = useAppSelector((s) => s.canvas.selectedDeviceId);
  const selected = devices.find((d) => d.id === selectedId);
  const inRack = devices.filter((d) => d.rack?.rack === rack.id);
  const room = rooms.find((r) => r.id === rack.room);
  const used = usedUnits(devices, rack);
  const canPlaceSelected = !!selected && !!rackUnits(selected) && selected.rack?.rack !== rack.id;

  const drop = (e: React.DragEvent, topU: number) => {
    e.preventDefault();
    const id = e.dataTransfer.getData(DRAG_TYPE) || dragging;
    setDragging(null);
    const device = devices.find((d) => d.id === id);
    const height = device && rackUnits(device);
    if (!device || !height) return;
    dispatch(placeInRack({ deviceId: device.id, rack: rack.id, u: Math.max(1, topU - height + 1) }));
  };

  const remove = () => {
    if (inRack.length > 0 && !confirm(`Удалить шкаф «${rack.name}»? Оборудование останется на схеме, но вне шкафов.`)) return;
    dispatch(removeRack(rack.id));
  };

  return (
    <Box component="section" aria-label={`Шкаф ${rack.name}`} sx={{ width: 300, flexShrink: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, flex: 1, minWidth: 0 }} noWrap>
          {rack.name}
        </Typography>
        <Tooltip title="Изменить шкаф">
          <IconButton size="small" aria-label={`Изменить шкаф «${rack.name}»`} onClick={onEdit}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Удалить шкаф">
          <IconButton size="small" aria-label={`Удалить шкаф «${rack.name}»`} onClick={remove}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      <Typography variant="body2" color="text.secondary">
        {room ? `${room.name} · ` : ''}
        занято {used}U из {rack.units}U
      </Typography>
      <Button
        size="small"
        sx={{ my: 0.5 }}
        disabled={!canPlaceSelected}
        onClick={() => selected && dispatch(placeInRack({ deviceId: selected.id, rack: rack.id }))}
      >
        Поставить выбранное
      </Button>
      <Box
        sx={{
          position: 'relative',
          height: rack.units * ROW,
          border: '3px solid #57606a',
          borderRadius: 1,
          bgcolor: '#0d1117',
          ml: 3.5,
        }}
      >
        {Array.from({ length: rack.units }, (_, i) => {
          const u = rack.units - i;
          return (
            <Box
              key={u}
              data-u={u}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => drop(e, u)}
              sx={{ position: 'absolute', left: 0, right: 0, top: i * ROW, height: ROW, borderTop: i ? '1px dashed #21262d' : 'none' }}
            >
              <Typography
                component="span"
                variant="caption"
                color="text.secondary"
                sx={{ position: 'absolute', left: -28, width: 22, textAlign: 'right', lineHeight: `${ROW}px` }}
              >
                {u}
              </Typography>
            </Box>
          );
        })}
        {inRack.map((d) => {
          const h = rackUnits(d) ?? 1;
          const top = (rack.units - (d.rack!.u + h - 1)) * ROW;
          const isSelected = d.id === selectedId;
          return (
            <Box
              key={d.id}
              component="button"
              type="button"
              draggable
              aria-label={`${label(d)}, юниты ${d.rack!.u}–${d.rack!.u + h - 1}. Стрелки вверх и вниз — переставить, Delete — вынуть`}
              onDragStart={(e: React.DragEvent) => {
                e.dataTransfer.setData(DRAG_TYPE, d.id);
                e.dataTransfer.effectAllowed = 'move';
                setDragging(d.id);
              }}
              onDragEnd={() => setDragging(null)}
              onClick={() => dispatch(selectDevice(d.id))}
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                  e.preventDefault();
                  dispatch(placeInRack({ deviceId: d.id, rack: rack.id, u: d.rack!.u + (e.key === 'ArrowUp' ? 1 : -1) }));
                } else if (e.key === 'Delete' || e.key === 'Backspace') {
                  e.preventDefault();
                  e.stopPropagation();
                  dispatch(removeFromRack(d.id));
                }
              }}
              sx={{
                position: 'absolute',
                left: 2,
                right: 2,
                top: top + 1,
                height: h * ROW - 2,
                px: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                bgcolor: isSelected ? '#1f3a5f' : '#21262d',
                border: `1px solid ${isSelected ? '#58a6ff' : '#484f58'}`,
                borderRadius: 0.5,
                color: '#e6edf3',
                font: 'inherit',
                fontSize: 12,
                textAlign: 'left',
                cursor: 'grab',
                overflow: 'hidden',
                // Перетаскиваемое устройство пропускает «бросок» к юнитам под собой
                pointerEvents: dragging === d.id ? 'none' : 'auto',
                '&:focus-visible': { outline: '2px solid #58a6ff', outlineOffset: 1 },
              }}
            >
              <Box component="span" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                {d.tag}
              </Box>
              <Box component="span" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                {d.manufacturer} {d.model}
              </Box>
              <Box component="span" sx={{ color: '#8b949e' }}>
                {h}U
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

/**
 * Вид «Шкафы»: компоновка оборудования в шкафах 19″. Устройства переносятся
 * мышью из списка «Не в шкафах» на нужный юнит; с клавиатуры — «Поставить
 * выбранное», стрелки и Delete на устройстве в шкафу.
 */
const RackView: React.FC = () => {
  const dispatch = useAppDispatch();
  const devices = useAppSelector((s) => s.canvas.devices);
  const racks = useAppSelector((s) => s.canvas.racks);
  const roomFilter = useAppSelector((s) => s.canvas.roomFilter);
  const rooms = useAppSelector((s) => s.canvas.rooms);
  const selectedId = useAppSelector((s) => s.canvas.selectedDeviceId);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ open: boolean; rack: Rack | null }>({ open: false, rack: null });

  const inFilter = (room?: string) => !roomFilter || room === roomFilter;
  const shownRacks = racks.filter((r) => inFilter(r.room));
  const loose = devices.filter((d) => rackUnits(d) && !d.rack && inFilter(d.room));
  const notRackable = devices.filter((d) => !rackUnits(d) && inFilter(d.room)).length;

  return (
    <Box role="region" aria-label="Шкафы" sx={{ position: 'absolute', inset: 0, zIndex: 5, display: 'flex', bgcolor: '#0d1117' }}>
      <Box
        aria-label="Не в шкафах"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const id = e.dataTransfer.getData(DRAG_TYPE) || dragging;
          setDragging(null);
          if (id) dispatch(removeFromRack(id));
        }}
        sx={{ width: 250, flexShrink: 0, borderRight: '1px solid #30363d', p: 1.5, overflow: 'auto' }}
      >
        {rooms.length > 0 && (
          <TextField
            select
            size="small"
            fullWidth
            label="Помещение"
            value={roomFilter ?? ''}
            onChange={(e) => dispatch(setRoomFilter(e.target.value || null))}
            SelectProps={{ native: true }}
            InputLabelProps={{ shrink: true }}
            sx={{ mb: 1.5 }}
          >
            <option value="">Все помещения</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </TextField>
        )}
        <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Не в шкафах
        </Typography>
        {loose.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ my: 1 }}>
            {devices.some((d) => rackUnits(d)) ? 'Всё оборудование 19″ стоит в шкафах.' : 'На схеме нет оборудования для шкафа 19″.'}
          </Typography>
        ) : (
          <List dense aria-label="Оборудование не в шкафах">
            {loose.map((d) => (
              <ListItemButton
                key={d.id}
                draggable
                selected={d.id === selectedId}
                onDragStart={(e) => {
                  e.dataTransfer.setData(DRAG_TYPE, d.id);
                  e.dataTransfer.effectAllowed = 'move';
                  setDragging(d.id);
                }}
                onDragEnd={() => setDragging(null)}
                onClick={() => dispatch(selectDevice(d.id))}
                sx={{ borderRadius: 1, cursor: 'grab' }}
              >
                <ListItemText primary={label(d)} secondary={`${rackUnits(d)}U · ${DEVICE_TYPE_LABELS[d.type] ?? d.type}`} />
              </ListItemButton>
            ))}
          </List>
        )}
        {notRackable > 0 && (
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
            Без монтажа в 19″ (микрофоны, колонки, дисплеи и т. п.): {notRackable}
          </Typography>
        )}
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
          Перетащите устройство на нужный юнит или выберите его и нажмите «Поставить выбранное» у шкафа. Высота в юнитах — из каталога
          (ориентировочно).
        </Typography>
      </Box>
      <Box sx={{ flex: 1, minWidth: 0, overflow: 'auto', p: 2, display: 'flex', gap: 4, alignItems: 'flex-start' }}>
        {shownRacks.map((r) => (
          <RackColumn key={r.id} rack={r} dragging={dragging} setDragging={setDragging} onEdit={() => setDialog({ open: true, rack: r })} />
        ))}
        <Box sx={{ pt: 0.5 }}>
          {shownRacks.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1, maxWidth: 280 }}>
              Шкафов пока нет. Добавьте шкаф 19″ и расставьте в нём усилители, коммутаторы, процессоры.
            </Typography>
          )}
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setDialog({ open: true, rack: null })}>
            Добавить шкаф
          </Button>
        </Box>
      </Box>
      <RackDialog open={dialog.open} rack={dialog.rack} onClose={() => setDialog((d) => ({ ...d, open: false }))} />
    </Box>
  );
};

export default RackView;

/** Шкаф и юнит устройства в панели свойств — без перетаскивания. */
export const DeviceRackField: React.FC<{ device: Device }> = ({ device }) => {
  const dispatch = useAppDispatch();
  const racks = useAppSelector((s) => s.canvas.racks);
  const height = rackUnits(device);
  const rack = racks.find((r) => r.id === device.rack?.rack);
  const [u, setU] = useState(String(device.rack?.u ?? ''));
  React.useEffect(() => setU(String(device.rack?.u ?? '')), [device.rack?.u]);
  if (!height) return null;

  const commitU = () => {
    const value = Number(u);
    if (rack && Number.isInteger(value) && value !== device.rack?.u)
      dispatch(placeInRack({ deviceId: device.id, rack: rack.id, u: value }));
    else setU(String(device.rack?.u ?? ''));
  };

  return (
    <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
      <TextField
        select
        size="small"
        fullWidth
        label={`Шкаф (${height}U)`}
        value={rack?.id ?? ''}
        onChange={(e) =>
          e.target.value ? dispatch(placeInRack({ deviceId: device.id, rack: e.target.value })) : dispatch(removeFromRack(device.id))
        }
        SelectProps={{ native: true }}
        InputLabelProps={{ shrink: true }}
        helperText={racks.length ? undefined : 'Шкафы добавляются на вкладке «Шкафы»'}
      >
        <option value="">— не в шкафу —</option>
        {racks.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </TextField>
      {rack && (
        <TextField
          size="small"
          label="Юнит (низ)"
          type="number"
          value={u}
          onChange={(e) => setU(e.target.value)}
          onBlur={commitU}
          onKeyDown={(e) => e.key === 'Enter' && commitU()}
          inputProps={{ min: 1, max: rack.units - height + 1 }}
          sx={{ width: 110, flexShrink: 0 }}
        />
      )}
    </Stack>
  );
};
