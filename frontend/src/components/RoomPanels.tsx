import React, { useEffect, useState } from 'react';
import { Box, Typography, TextField, Button, List, ListItemButton, ListItemText, Stack, Tooltip, ButtonBase } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import FilterCenterFocusIcon from '@mui/icons-material/FilterCenterFocus';
import { useAppDispatch, useAppSelector } from '../store';
import {
  addRoom,
  updateRoom,
  removeRoom,
  setDeviceRoom,
  selectRoom,
  selectDevice,
  deselectAll,
  setRoomFilter,
  requestFit,
  showToast,
} from '../features/canvasSlice';
import { Device, Room } from '../types/device.types';
import { ROOM_COLORS, newRoomId, nextRoomColor, nextRoomName } from '../data/rooms';
import { deviceTypeLabel } from '../data/labels';
import { categoryColor } from './deviceGeometry';

const NEW_ROOM = '__new__';

/** Новое помещение со следующим свободным названием и цветом. */
function makeRoom(rooms: Room[], name?: string): Room {
  return { id: newRoomId(), name: name?.trim() || nextRoomName(rooms), color: nextRoomColor(rooms) };
}

/** Помещение устройства: выбор из списка или создание нового прямо здесь. */
export const DeviceRoomField: React.FC<{ device: Device }> = ({ device }) => {
  const dispatch = useAppDispatch();
  const rooms = useAppSelector((s) => s.canvas.rooms);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const create = () => {
    const room = makeRoom(rooms, name);
    dispatch(addRoom(room));
    dispatch(setDeviceRoom({ id: device.id, room: room.id }));
    setCreating(false);
  };

  return (
    <Box sx={{ mb: 1.5 }}>
      <TextField
        select
        label="Помещение"
        size="small"
        fullWidth
        value={creating ? NEW_ROOM : device.room ?? ''}
        onChange={(e) => {
          if (e.target.value === NEW_ROOM) {
            setName(nextRoomName(rooms));
            setCreating(true);
            return;
          }
          setCreating(false);
          dispatch(setDeviceRoom({ id: device.id, room: e.target.value || null }));
        }}
        SelectProps={{ native: true }}
        InputLabelProps={{ shrink: true }}
      >
        <option value="">— вне помещений —</option>
        {rooms.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
        <option value={NEW_ROOM}>＋ Новое помещение…</option>
      </TextField>
      {creating && (
        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          <TextField
            size="small"
            label="Название помещения"
            value={name}
            autoFocus
            fullWidth
            inputProps={{ maxLength: 64 }}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') create();
              if (e.key === 'Escape') setCreating(false);
            }}
          />
          <Button variant="outlined" size="small" onClick={create}>
            Создать
          </Button>
        </Stack>
      )}
    </Box>
  );
};

/** Список помещений и устройств по помещениям — когда на холсте ничего не выбрано. */
export const RoomsAndDevices: React.FC<{ devices: Device[] }> = ({ devices }) => {
  const dispatch = useAppDispatch();
  const rooms = useAppSelector((s) => s.canvas.rooms);
  const byTag = (a: Device, b: Device) => (a.tag ?? '').localeCompare(b.tag ?? '', 'ru', { numeric: true });
  const groups = [
    ...rooms.map((r) => ({ room: r as Room | null, items: devices.filter((d) => d.room === r.id).sort(byTag) })),
    { room: null, items: devices.filter((d) => !d.room || !rooms.some((r) => r.id === d.room)).sort(byTag) },
  ].filter((g) => g.room || g.items.length > 0);

  const add = () => {
    const room = makeRoom(rooms);
    dispatch(addRoom(room));
    dispatch(selectRoom(room.id));
  };

  return (
    <Box sx={{ p: 2, height: '100%', overflow: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Устройства ({devices.length})
        </Typography>
        <Tooltip title="Помещения группируют устройства рамкой на холсте, в спецификации и кабельном журнале">
          <Button size="small" startIcon={<AddIcon />} onClick={add} sx={{ ml: 'auto' }}>
            Помещение
          </Button>
        </Tooltip>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        Выберите устройство или помещение здесь или на холсте
      </Typography>
      {groups.map((g) => (
        <Box key={g.room?.id ?? 'none'} sx={{ mb: 1.5 }}>
          {rooms.length > 0 &&
            (g.room ? (
              <ButtonBase
                onClick={() => dispatch(selectRoom(g.room!.id))}
                aria-label={`Помещение ${g.room.name}: открыть`}
                sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', justifyContent: 'flex-start', py: 0.5, borderRadius: 1 }}
              >
                <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: g.room.color }} />
                <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {g.room.name} ({g.items.length})
                </Typography>
              </ButtonBase>
            ) : (
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>
                Вне помещений ({g.items.length})
              </Typography>
            ))}
          <List dense disablePadding aria-label={g.room ? `Устройства: ${g.room.name}` : 'Устройства на схеме'}>
            {g.items.map((d) => (
              <ListItemButton key={d.id} onClick={() => dispatch(selectDevice(d.id))} sx={{ borderRadius: 1 }}>
                <Box sx={{ width: 4, alignSelf: 'stretch', mr: 1.5, borderRadius: 1, bgcolor: categoryColor(d.category), flexShrink: 0 }} />
                <ListItemText
                  primary={`${d.tag ?? ''} · ${d.model}`}
                  secondary={deviceTypeLabel(d.type)}
                  primaryTypographyProps={{ noWrap: true, variant: 'body2' }}
                />
              </ListItemButton>
            ))}
          </List>
        </Box>
      ))}
    </Box>
  );
};

/** Выбранное помещение: название, цвет, фильтр холста, устройства, удаление. */
export const RoomPanel: React.FC<{ room: Room }> = ({ room }) => {
  const dispatch = useAppDispatch();
  const devices = useAppSelector((s) => s.canvas.devices);
  const roomFilter = useAppSelector((s) => s.canvas.roomFilter);
  const [name, setName] = useState(room.name);
  useEffect(() => setName(room.name), [room.name]);
  const members = devices.filter((d) => d.room === room.id);
  const commit = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== room.name) dispatch(updateRoom({ id: room.id, name: trimmed }));
    else setName(room.name);
  };

  return (
    <Box sx={{ p: 2, height: '100%', overflow: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Помещение
        </Typography>
        <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => dispatch(deselectAll())} sx={{ ml: 'auto' }}>
          Все устройства
        </Button>
      </Box>
      <TextField
        label="Название"
        size="small"
        fullWidth
        value={name}
        error={!name.trim()}
        helperText={!name.trim() ? 'Название не может быть пустым' : 'в спецификации, кабельном журнале и на рамке'}
        inputProps={{ maxLength: 64 }}
        onChange={(e) => setName(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        sx={{ mb: 1.5 }}
      />
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
        Цвет рамки
      </Typography>
      <Stack direction="row" spacing={0.75} sx={{ mb: 2 }} role="radiogroup" aria-label="Цвет рамки">
        {ROOM_COLORS.map((c) => (
          <ButtonBase
            key={c}
            role="radio"
            aria-checked={room.color === c}
            aria-label={`Цвет ${c}`}
            onClick={() => dispatch(updateRoom({ id: room.id, color: c }))}
            sx={{
              width: 24,
              height: 24,
              borderRadius: '6px',
              bgcolor: c,
              outline: room.color === c ? '2px solid #fff' : 'none',
              outlineOffset: 2,
            }}
          />
        ))}
      </Stack>
      <Button
        fullWidth
        variant={roomFilter === room.id ? 'contained' : 'outlined'}
        size="small"
        startIcon={<FilterCenterFocusIcon />}
        onClick={() => {
          dispatch(setRoomFilter(roomFilter === room.id ? null : room.id));
          dispatch(requestFit());
        }}
        sx={{ mb: 2 }}
      >
        {roomFilter === room.id ? 'Показать все помещения' : 'Показать только это помещение'}
      </Button>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        Устройства ({members.length})
      </Typography>
      {members.length === 0 && (
        <Typography variant="caption" color="text.secondary">
          Пока пусто: выберите устройство и укажите помещение в его свойствах, или включите фильтр по помещению и
          добавьте устройства из библиотеки
        </Typography>
      )}
      <List dense disablePadding aria-label={`Устройства: ${room.name}`}>
        {members.map((d) => (
          <ListItemButton key={d.id} onClick={() => dispatch(selectDevice(d.id))} sx={{ borderRadius: 1 }}>
            <ListItemText primary={`${d.tag ?? ''} · ${d.model}`} primaryTypographyProps={{ noWrap: true, variant: 'body2' }} />
          </ListItemButton>
        ))}
      </List>
      <Button
        fullWidth
        color="error"
        variant="outlined"
        startIcon={<DeleteIcon />}
        sx={{ mt: 2 }}
        onClick={() => {
          dispatch(removeRoom(room.id));
          dispatch(showToast({ message: `Помещение «${room.name}» удалено, устройства остались на схеме`, severity: 'info' }));
        }}
      >
        Удалить помещение
      </Button>
    </Box>
  );
};
