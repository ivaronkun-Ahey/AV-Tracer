import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  FormControlLabel,
  Switch,
  Divider,
  Button,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  ButtonBase,
  List,
  ListItemButton,
  ListItemText,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useAppSelector, useAppDispatch } from '../store';
import {
  updateDeviceProperty,
  setDeviceTag,
  removeDevice,
  removeConnection,
  selectDevice,
  selectConnection,
  deselectAll,
  connect,
  showToast,
} from '../features/canvasSlice';
import { isPortBusy, possibleLinks, Link } from '../features/connectionRules';
import { Connection, Device, PropValue } from '../types/device.types';
import { deviceTypeLabel, propertyLabel, portLabel, SIGNAL_LABELS, DIRECTION_LABELS } from '../data/labels';
import { signalColor, categoryColor } from './deviceGeometry';
import { deviceTags } from '../data/deviceTags';
import ConnectionInspector from './ConnectionInspector';
import NumberField from './NumberField';

const PropertiesPanel: React.FC = () => {
  const dispatch = useAppDispatch();
  const selectedDeviceId = useAppSelector((s) => s.canvas.selectedDeviceId);
  const selectedConnectionId = useAppSelector((s) => s.canvas.selectedConnectionId);
  const devices = useAppSelector((s) => s.canvas.devices);
  const connections = useAppSelector((s) => s.canvas.connections);

  const device = devices.find((d) => d.id === selectedDeviceId);
  const tag = device ? deviceTags(devices)[device.id] : '';

  if (!device) {
    // Выбран кабель — показываем инспектор соединения
    if (selectedConnectionId) {
      return <ConnectionInspector />;
    }
    return <DeviceList devices={devices} onSelect={(id) => dispatch(selectDevice(id))} />;
  }

  const deviceName = (id: string) => {
    const d = devices.find((x) => x.id === id);
    return d ? d.model : id;
  };

  const deviceConnections = connections.filter(
    (c) => c.from.device === device.id || c.to.device === device.id
  );

  const onChange = (property: string, value: PropValue) =>
    dispatch(updateDeviceProperty({ id: device.id, property, value }));

  return (
    <Box sx={{ p: 2, height: '100%', overflow: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Свойства
        </Typography>
        <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => dispatch(deselectAll())} sx={{ ml: 'auto' }}>
          Все устройства
        </Button>
      </Box>

      {/* Шапка устройства */}
      <Box sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
          <Chip label={deviceTypeLabel(device.type)} size="small" sx={{ bgcolor: categoryColor(device.category), color: '#fff' }} />
          <Chip label={tag} size="small" variant="outlined" />
        </Stack>
        <Typography variant="h6" sx={{ fontSize: '1.15rem', lineHeight: 1.2 }}>
          {device.model}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {device.manufacturer}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {device.full_name}
        </Typography>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Параметры */}
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        Параметры
      </Typography>
      <TagField
        key={device.id}
        value={tag}
        isTaken={(t) => devices.some((d) => d.id !== device.id && d.tag === t)}
        onCommit={(t) => dispatch(setDeviceTag({ id: device.id, tag: t }))}
      />
      {renderProperties(device, onChange)}
      {renderChannelGains(device, connections, onChange)}

      {/* Подключения */}
      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        Подключения ({deviceConnections.length})
      </Typography>
      {deviceConnections.length === 0 && (
        <Typography variant="caption" color="text.secondary">
          Пока нет соединений
        </Typography>
      )}
      <Stack spacing={1}>
        {deviceConnections.map((c) => {
          const outgoing = c.from.device === device.id;
          const otherId = outgoing ? c.to.device : c.from.device;
          return (
            <Box
              key={c.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                p: 1,
                bgcolor: 'rgba(255,255,255,0.04)',
                borderRadius: 1,
              }}
            >
              <ButtonBase
                onClick={() => dispatch(selectConnection(c.id))}
                aria-label={`Кабель ${c.label ?? ''} ${outgoing ? 'к' : 'от'} ${deviceName(otherId)}: открыть`}
                sx={{ minWidth: 0, flex: 1, display: 'block', textAlign: 'left', borderRadius: 1 }}
              >
                <Typography variant="body2" noWrap>
                  {outgoing ? '→' : '←'} {deviceName(otherId)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {c.label ? `${c.label} · ` : ''}
                  {c.cable_type.toUpperCase()}
                </Typography>
              </ButtonBase>
              <Tooltip title="Удалить соединение">
                <IconButton size="small" onClick={() => dispatch(removeConnection(c.id))}>
                  <LinkOffIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          );
        })}
      </Stack>

      <ConnectForm key={device.id} device={device} />

      {/* Порты */}
      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        Порты ({device.ports.length})
      </Typography>
      {device.ports.map((port, idx) => (
        <Box key={idx} sx={{ mb: 0.75, p: 1, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: signalColor(port.signal_type), flexShrink: 0 }} />
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {portLabel(port)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {DIRECTION_LABELS[port.direction]} · {SIGNAL_LABELS[port.signal_type]}
            </Typography>
          </Box>
        </Box>
      ))}

      {/* Удаление */}
      <Divider sx={{ my: 2 }} />
      <Button
        fullWidth
        color="error"
        variant="outlined"
        startIcon={<DeleteIcon />}
        onClick={() => {
          dispatch(removeDevice(device.id));
          dispatch(showToast({ message: 'Устройство удалено', severity: 'info' }));
        }}
      >
        Удалить устройство
      </Button>
    </Box>
  );
};

/** Список устройств схемы, когда ничего не выбрано: выбор без холста (с клавиатуры). */
const DeviceList: React.FC<{ devices: Device[]; onSelect: (id: string) => void }> = ({ devices, onSelect }) => {
  if (devices.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center', mt: 4 }}>
        <Typography sx={{ fontSize: 40, mb: 1 }}>👆</Typography>
        <Typography variant="body2" color="text.secondary">
          Здесь появятся параметры устройства или кабеля, выбранного на холсте
        </Typography>
      </Box>
    );
  }
  const sorted = [...devices].sort((a, b) => (a.tag ?? '').localeCompare(b.tag ?? '', 'ru', { numeric: true }));
  return (
    <Box sx={{ p: 2, height: '100%', overflow: 'auto' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        Устройства на схеме ({devices.length})
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        Выберите устройство здесь или на холсте
      </Typography>
      <List dense disablePadding aria-label="Устройства на схеме">
        {sorted.map((d) => (
          <ListItemButton key={d.id} onClick={() => onSelect(d.id)} sx={{ borderRadius: 1 }}>
            <Box
              sx={{ width: 4, alignSelf: 'stretch', mr: 1.5, borderRadius: 1, bgcolor: categoryColor(d.category), flexShrink: 0 }}
            />
            <ListItemText
              primary={`${d.tag ?? ''} · ${d.model}`}
              secondary={deviceTypeLabel(d.type)}
              primaryTypographyProps={{ noWrap: true, variant: 'body2' }}
            />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );
};

/**
 * Подключение кабеля без холста: порт этого устройства и подходящий порт
 * другого. Варианты — только допустимые кабели (совместимые свободные порты).
 */
const ConnectForm: React.FC<{ device: Device }> = ({ device }) => {
  const dispatch = useAppDispatch();
  const devices = useAppSelector((s) => s.canvas.devices);
  const connections = useAppSelector((s) => s.canvas.connections);
  const [portId, setPortId] = useState('');
  const [choice, setChoice] = useState('');

  const freePorts = device.ports.filter((p) => !isPortBusy(connections, device.id, p));
  const links: Link[] = portId ? possibleLinks(devices, connections, { device: device.id, port: portId }) : [];
  const linkKey = (l: Link) => `${l.from.device}|${l.from.port}|${l.to.device}|${l.to.port}`;
  const describe = (l: Link) => {
    const outgoing = l.from.device === device.id;
    const end = outgoing ? l.to : l.from;
    const other = devices.find((d) => d.id === end.device);
    const port = other?.ports.find((p) => p.id === end.port);
    return `${outgoing ? '→' : '←'} ${other?.tag ?? ''} ${other?.model ?? ''} · ${port ? portLabel(port) : end.port}`;
  };

  const submit = () => {
    const link = links.find((l) => linkKey(l) === choice);
    const toPort = link && devices.find((d) => d.id === link.to.device)?.ports.find((p) => p.id === link.to.port);
    if (!link || !toPort) return;
    dispatch(connect({ from: link.from, to: link.to, cableType: toPort.type }));
    dispatch(showToast({ message: 'Соединение создано', severity: 'success' }));
    setPortId('');
    setChoice('');
  };

  if (freePorts.length === 0) return null;
  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        Подключить кабель
      </Typography>
      <TextField
        select
        label="Порт этого устройства"
        size="small"
        fullWidth
        value={portId}
        onChange={(e) => {
          setPortId(e.target.value);
          setChoice('');
        }}
        SelectProps={{ native: true }}
        InputLabelProps={{ shrink: true }}
        sx={{ mb: 1.5 }}
      >
        <option value="">— выберите порт —</option>
        {freePorts.map((p) => (
          <option key={p.id} value={p.id}>
            {portLabel(p)} ({DIRECTION_LABELS[p.direction]})
          </option>
        ))}
      </TextField>
      {portId && (
        <TextField
          select
          label="С чем соединить"
          size="small"
          fullWidth
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          disabled={links.length === 0}
          helperText={links.length === 0 ? 'Нет свободных совместимых портов на других устройствах' : undefined}
          SelectProps={{ native: true }}
          InputLabelProps={{ shrink: true }}
          sx={{ mb: 1.5 }}
        >
          <option value="">— выберите —</option>
          {links.map((l) => (
            <option key={linkKey(l)} value={linkKey(l)}>
              {describe(l)}
            </option>
          ))}
        </TextField>
      )}
      <Button variant="outlined" size="small" fullWidth disabled={!choice} onClick={submit}>
        Соединить
      </Button>
    </Box>
  );
};

/** Обозначение устройства (MIC-01): редактируется, должно быть уникальным. */
const TagField: React.FC<{ value: string; isTaken: (tag: string) => boolean; onCommit: (tag: string) => void }> = ({
  value,
  isTaken,
  onCommit,
}) => {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const normalized = text.trim().toUpperCase();
  const error = !normalized ? 'Обозначение не может быть пустым' : isTaken(normalized) ? 'Такое обозначение уже есть' : '';
  const commit = () => {
    if (!error && normalized !== value) onCommit(normalized);
    else setText(value);
  };
  return (
    <TextField
      label="Обозначение на схеме"
      size="small"
      fullWidth
      value={text}
      error={!!error}
      helperText={error || 'попадает в спецификацию и кабельный журнал'}
      inputProps={{ maxLength: 32 }}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      sx={{ mb: 1.5 }}
    />
  );
};

const GAIN_STAGES = ['mixer', 'dsp', 'audio_interface'];

/**
 * Усиление по каналам: у каждого подключённого входа микшера/DSP/интерфейса
 * своё значение (gain:<порт>); пока оно не задано, действует «Усиление входа».
 */
function renderChannelGains(
  device: Device,
  connections: Connection[],
  onChange: (prop: string, value: PropValue) => void
) {
  if (!GAIN_STAGES.includes(device.type)) return null;
  const connectedInputs = device.ports.filter(
    (p) => p.direction === 'input' && connections.some((c) => c.to.device === device.id && c.to.port === p.id)
  );
  if (connectedInputs.length === 0) return null;
  const fallback = typeof device.properties.input_gain === 'number' ? device.properties.input_gain : 0;
  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        Усиление по каналам (подключённые входы)
      </Typography>
      {connectedInputs.map((port) => {
        const key = `gain:${port.id}`;
        const own = device.properties[key];
        return (
          <NumberField
            key={`${device.id}:${key}`}
            label={`${portLabel(port)}, дБ`}
            size="small"
            fullWidth
            value={typeof own === 'number' ? own : fallback}
            helperText={typeof own === 'number' ? undefined : 'как «Усиление входа»'}
            onCommit={(n) => onChange(key, n)}
            sx={{ mb: 1.5 }}
          />
        );
      })}
    </Box>
  );
}

/** Универсальный рендер параметров: тип поля выбирается по типу значения. */
function renderProperties(device: Device, onChange: (prop: string, value: PropValue) => void) {
  const props = device.properties || {};
  // Параметры каналов (gain:<порт>, phantom:<порт>) показываются отдельным блоком
  const keys = Object.keys(props).filter((k) => !k.includes(':'));
  if (keys.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Нет настраиваемых параметров
      </Typography>
    );
  }
  return (
    <>
      {keys.map((key) => {
        const value = props[key];
        if (typeof value === 'boolean') {
          return (
            <FormControlLabel
              key={key}
              sx={{ display: 'flex', mb: 0.5 }}
              control={<Switch checked={value} onChange={(e) => onChange(key, e.target.checked)} />}
              label={<Typography variant="body2">{propertyLabel(key)}</Typography>}
            />
          );
        }
        if (typeof value === 'number') {
          return (
            <NumberField
              key={`${device.id}:${key}`}
              label={propertyLabel(key)}
              size="small"
              fullWidth
              value={value}
              onCommit={(n) => onChange(key, n)}
              sx={{ mb: 1.5 }}
            />
          );
        }
        return (
          <TextField
            key={`${device.id}:${key}`}
            label={propertyLabel(key)}
            size="small"
            fullWidth
            value={Array.isArray(value) ? value.join(', ') : String(value ?? '')}
            disabled={Array.isArray(value)}
            onChange={(e) => onChange(key, e.target.value)}
            sx={{ mb: 1.5 }}
          />
        );
      })}
    </>
  );
}

export default PropertiesPanel;
