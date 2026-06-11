import React from 'react';
import { Drawer, Box, Typography, IconButton, Chip, Stack, Alert, Divider } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useAppSelector, useAppDispatch } from '../store';
import { setShowSimulation, selectDevice } from '../features/canvasSlice';
import { deviceTypeLabel } from '../data/labels';

const SimulationPanel: React.FC = () => {
  const dispatch = useAppDispatch();
  const simulation = useAppSelector((s) => s.canvas.simulation);
  const showSimulation = useAppSelector((s) => s.canvas.showSimulation);
  const devices = useAppSelector((s) => s.canvas.devices);

  const name = (id: string) => devices.find((d) => d.id === id)?.model || id;

  const close = () => dispatch(setShowSimulation(false));

  return (
    <Drawer
      anchor="bottom"
      open={showSimulation && !!simulation}
      onClose={close}
      PaperProps={{ sx: { bgcolor: '#161b22', borderTop: '1px solid #30363d', maxHeight: '55vh' } }}
    >
      {simulation && (
        <Box sx={{ p: 2.5 }}>
          {/* Шапка */}
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            {simulation.valid ? (
              <CheckCircleIcon sx={{ color: '#3DDC84', mr: 1 }} />
            ) : (
              <ErrorIcon sx={{ color: '#F44336', mr: 1 }} />
            )}
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {simulation.valid ? 'Система собрана корректно' : 'Найдены проблемы'}
            </Typography>
            <Chip
              size="small"
              label={simulation.computed_by === 'server' ? 'расчёт на сервере' : 'расчёт в браузере'}
              sx={{ ml: 2, bgcolor: 'rgba(255,255,255,0.08)' }}
            />
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
                    onClick={() => dispatch(selectDevice(e.device))}
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
                    onClick={() => dispatch(selectDevice(w.device))}
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
                    <Typography variant="caption" color="text.secondary">
                      {flow.type === 'audio'
                        ? `Итоговый уровень: ${flow.final_level_db} дБ · ${flow.status === 'ok' ? 'в норме' : 'требует внимания'}`
                        : `Разрешение: ${flow.resolution}`}
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
