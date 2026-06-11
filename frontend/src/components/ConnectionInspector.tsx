import React from 'react';
import { Box, Typography, Chip, Divider, TextField, Button, Alert, Stack } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { useAppSelector, useAppDispatch } from '../store';
import { updateConnectionLength, removeConnection, selectDevice, showToast } from '../features/canvasSlice';
import { SIGNAL_LABELS, portLabel, deviceTypeLabel } from '../data/labels';
import { cableMaxLength, CABLE_DESCRIPTION } from '../data/cables';
import { signalColor } from './deviceGeometry';

const ConnectionInspector: React.FC = () => {
  const dispatch = useAppDispatch();
  const connectionId = useAppSelector((s) => s.canvas.selectedConnectionId);
  const connections = useAppSelector((s) => s.canvas.connections);
  const devices = useAppSelector((s) => s.canvas.devices);

  const conn = connections.find((c) => c.id === connectionId);
  if (!conn) return null;

  const fromDev = devices.find((d) => d.id === conn.from.device);
  const toDev = devices.find((d) => d.id === conn.to.device);
  const fromPort = fromDev?.ports.find((p) => p.id === conn.from.port);
  const toPort = toDev?.ports.find((p) => p.id === conn.to.port);

  const sig = fromPort?.signal_type || 'control';
  const color = signalColor(sig);
  const maxLen = cableMaxLength(conn.cable_type);
  const tooLong = conn.cable_length > maxLen;

  const endpoint = (dev: typeof fromDev, port: typeof fromPort, role: string) => (
    <Box sx={{ p: 1.25, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 1, borderLeft: `3px solid ${color}` }}>
      <Typography variant="caption" color="text.secondary">
        {role}
      </Typography>
      <Typography
        variant="body2"
        sx={{ fontWeight: 600, cursor: dev ? 'pointer' : 'default' }}
        onClick={() => dev && dispatch(selectDevice(dev.id))}
      >
        {dev ? dev.model : '—'}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {dev ? deviceTypeLabel(dev.type) : ''} · {port ? portLabel(port) : conn[role === 'Источник' ? 'from' : 'to'].port}
      </Typography>
    </Box>
  );

  return (
    <Box sx={{ p: 2, height: '100%', overflow: 'auto' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
        Соединение
      </Typography>

      <Chip
        label={SIGNAL_LABELS[sig as keyof typeof SIGNAL_LABELS] || sig}
        size="small"
        sx={{ bgcolor: color, color: '#fff', mb: 2 }}
      />

      <Stack spacing={1} sx={{ mb: 2 }}>
        {endpoint(fromDev, fromPort, 'Источник')}
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <ArrowDownwardIcon sx={{ color }} />
        </Box>
        {endpoint(toDev, toPort, 'Приёмник')}
      </Stack>

      <Divider sx={{ my: 2 }} />

      {/* Кабель */}
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        Кабель
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Box sx={{ width: 24, height: 4, bgcolor: color, borderRadius: 2 }} />
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {conn.cable_type.toUpperCase()}
        </Typography>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        {CABLE_DESCRIPTION[conn.cable_type] || ''}
      </Typography>

      <TextField
        label="Длина кабеля (м)"
        type="number"
        size="small"
        fullWidth
        value={conn.cable_length}
        onChange={(e) => dispatch(updateConnectionLength({ id: conn.id, length: Number(e.target.value) }))}
        helperText={`Рекомендуемый максимум для ${conn.cable_type.toUpperCase()}: ${maxLen} м`}
        sx={{ mb: 1.5 }}
      />
      {tooLong && (
        <Alert severity="warning" variant="outlined" sx={{ mb: 2 }}>
          Длина {conn.cable_length} м превышает рекомендуемые {maxLen} м — возможны потери сигнала.
        </Alert>
      )}

      <Divider sx={{ my: 2 }} />
      <Button
        fullWidth
        color="error"
        variant="outlined"
        startIcon={<DeleteIcon />}
        onClick={() => {
          dispatch(removeConnection(conn.id));
          dispatch(showToast({ message: 'Соединение удалено', severity: 'info' }));
        }}
      >
        Удалить соединение
      </Button>
    </Box>
  );
};

export default ConnectionInspector;
