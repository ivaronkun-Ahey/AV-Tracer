import React from 'react';
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
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import { useAppSelector, useAppDispatch } from '../store';
import {
  updateDeviceProperty,
  removeDevice,
  removeConnection,
  showToast,
} from '../features/canvasSlice';
import { Device, PropValue } from '../types/device.types';
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
    return (
      <Box sx={{ p: 3, textAlign: 'center', mt: 4 }}>
        <Typography sx={{ fontSize: 40, mb: 1 }}>👆</Typography>
        <Typography variant="body2" color="text.secondary">
          Выберите устройство или кабель на холсте, чтобы увидеть и изменить параметры
        </Typography>
      </Box>
    );
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
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
        Свойства
      </Typography>

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
      {renderProperties(device, onChange)}

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
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="body2" noWrap>
                  {outgoing ? '→' : '←'} {deviceName(otherId)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {c.cable_type.toUpperCase()}
                </Typography>
              </Box>
              <Tooltip title="Удалить соединение">
                <IconButton size="small" onClick={() => dispatch(removeConnection(c.id))}>
                  <LinkOffIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          );
        })}
      </Stack>

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

/** Универсальный рендер параметров: тип поля выбирается по типу значения. */
function renderProperties(device: Device, onChange: (prop: string, value: PropValue) => void) {
  const props = device.properties || {};
  const keys = Object.keys(props);
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
