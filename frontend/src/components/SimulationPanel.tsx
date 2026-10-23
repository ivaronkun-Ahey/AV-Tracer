import React from 'react';
import { Drawer, Box, Typography, IconButton, Chip, Stack, Alert, Divider } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useAppSelector, useAppDispatch } from '../store';
import { setShowSimulation, selectDevice, selectConnection } from '../features/canvasSlice';
import { deviceTypeLabel } from '../data/labels';
import { LINE_MAX_DBU, LINE_MIN_DBU } from '../sim/engine';
import { SignalFlow, SimIssue } from '../types/device.types';

function levelVerdict(db: number): string {
  if (db < LINE_MIN_DBU) return 'слабый сигнал';
  if (db > LINE_MAX_DBU) return 'перегрузка';
  return 'в норме';
}

const SimulationPanel: React.FC = () => {
  const dispatch = useAppDispatch();
  const simulation = useAppSelector((s) => s.canvas.simulation);
  const showSimulation = useAppSelector((s) => s.canvas.showSimulation);
  const devices = useAppSelector((s) => s.canvas.devices);

  const name = (id: string) => devices.find((d) => d.id === id)?.model || id;

  const close = () => dispatch(setShowSimulation(false));

  // Проблема с кабелем выделяет кабель, остальные — устройство
  const focusIssue = (issue: SimIssue) =>
    dispatch(issue.connection ? selectConnection(issue.connection) : selectDevice(issue.device));

  const flowCaption = (flow: SignalFlow) => {
    if (flow.type === 'video') {
      return `Разрешение: ${flow.resolution}${flow.status === 'ok' ? '' : ' · есть замечания'}`;
    }
    const db = flow.final_level_db ?? 0;
    const sign = db > 0 ? '+' : '';
    return `Уровень на «${name(flow.level_at || flow.path[flow.path.length - 1])}»: ${sign}${db} дБu · ${levelVerdict(db)}`;
  };

  const header = !simulation
    ? null
    : !simulation.valid
      ? { icon: <ErrorIcon sx={{ color: '#F44336', mr: 1 }} />, text: 'Найдены ошибки' }
      : simulation.warnings.length > 0
        ? {
            icon: <WarningAmberIcon sx={{ color: '#FF9800', mr: 1 }} />,
            text: `Система собрана, есть предупреждения (${simulation.warnings.length})`,
          }
        : { icon: <CheckCircleIcon sx={{ color: '#3DDC84', mr: 1 }} />, text: 'Система собрана корректно' };

  return (
    <Drawer
      anchor="bottom"
      open={showSimulation && !!simulation}
      onClose={close}
      PaperProps={{ sx: { bgcolor: '#161b22', borderTop: '1px solid #30363d', maxHeight: '55vh' } }}
    >
      {simulation && header && (
        <Box sx={{ p: 2.5 }}>
          {/* Шапка */}
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            {header.icon}
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {header.text}
            </Typography>
            <IconButton onClick={close} sx={{ ml: 'auto' }} size="small">
              <CloseIcon />
            </IconButton>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
            {/* Левая колонка: проблемы */}
            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Ошибки и предупреждения
              </Typography>
              <Stack spacing={1}>
                {simulation.errors.length === 0 && simulation.warnings.length === 0 && (
                  <Alert severity="success" variant="outlined">
                    Проблем не обнаружено
                  </Alert>
                )}
                {simulation.errors.map((e, i) => (
                  <Alert
                    key={`e${i}`}
                    severity="error"
                    variant="outlined"
                    onClick={() => focusIssue(e)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <b>{name(e.device)}:</b> {e.message}
                  </Alert>
                ))}
                {simulation.warnings.map((w, i) => (
                  <Alert
                    key={`w${i}`}
                    severity="warning"
                    variant="outlined"
                    onClick={() => focusIssue(w)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <b>{name(w.device)}:</b> {w.message}
                  </Alert>
                ))}
              </Stack>
            </Box>

            {/* Правая колонка: цепочки сигнала */}
            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Цепочки сигнала ({simulation.signal_flows.length})
              </Typography>
              {simulation.signal_flows.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  Источники сигнала (микрофоны, камеры) не найдены
                </Typography>
              )}
              <Stack spacing={1.5} divider={<Divider flexItem sx={{ borderColor: '#222' }} />}>
                {simulation.signal_flows.map((flow, i) => (
                  <Box key={i}>
                    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5, mb: 0.5 }}>
                      <Chip
                        size="small"
                        label={flow.type === 'audio' ? '🔊 Аудио' : '📹 Видео'}
                        sx={{ bgcolor: flow.type === 'audio' ? '#FF6B0033' : '#00B8D433', mr: 1 }}
                      />
                      {flow.path.map((id, idx) => (
                        <React.Fragment key={idx}>
                          {idx > 0 && <ArrowForwardIcon sx={{ fontSize: 14, color: 'text.secondary' }} />}
                          <Chip
                            size="small"
                            variant="outlined"
                            label={name(id)}
                            title={deviceTypeLabel(devices.find((d) => d.id === id)?.type || '')}
                          />
                        </React.Fragment>
                      ))}
                    </Box>
                    <Typography
                      variant="caption"
                      sx={{ color: flow.status === 'ok' ? 'text.secondary' : '#FF9800' }}
                    >
                      {flowCaption(flow)}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          </Box>
        </Box>
      )}
    </Drawer>
  );
};

export default SimulationPanel;
