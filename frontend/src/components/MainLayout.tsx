import React, { useRef, useState } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Button,
  ButtonGroup,
  Drawer,
  Snackbar,
  Alert,
  Tooltip,
  IconButton,
  Divider,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SaveIcon from '@mui/icons-material/Save';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import DeleteIcon from '@mui/icons-material/Delete';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import EquipmentLibrary from './EquipmentLibrary';
import CanvasWorkspace from './CanvasWorkspace';
import PropertiesPanel from './PropertiesPanel';
import SimulationPanel from './SimulationPanel';
import { useAppDispatch, useAppSelector } from '../store';
import {
  clearCanvas,
  loadProject,
  undo,
  redo,
  setSimulation,
  showToast,
  clearToast,
} from '../features/canvasSlice';
import { runSimulation } from '../sim/engine';
import { SimulationResult } from '../types/device.types';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

const MainLayout: React.FC = () => {
  const dispatch = useAppDispatch();
  const devices = useAppSelector((s) => s.canvas.devices);
  const connections = useAppSelector((s) => s.canvas.connections);
  const canUndo = useAppSelector((s) => s.canvas.past.length > 0);
  const canRedo = useAppSelector((s) => s.canvas.future.length > 0);
  const toast = useAppSelector((s) => s.canvas.toast);

  const [simulationRunning, setSimulationRunning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClear = () => {
    if (devices.length === 0) return;
    if (confirm('Очистить весь холст? Все устройства и соединения будут удалены.')) {
      dispatch(clearCanvas());
    }
  };

  const handleSave = () => {
    const project = { devices, connections, timestamp: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `av-tracer-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    dispatch(showToast({ message: 'Проект сохранён в файл', severity: 'success' }));
  };

  const handleOpenFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!Array.isArray(parsed.devices) || !Array.isArray(parsed.connections)) {
          throw new Error('bad format');
        }
        dispatch(loadProject({ devices: parsed.devices, connections: parsed.connections }));
        dispatch(showToast({ message: 'Проект загружен', severity: 'success' }));
      } catch {
        dispatch(showToast({ message: 'Не удалось открыть файл: неверный формат', severity: 'error' }));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSimulate = async () => {
    if (devices.length === 0) {
      dispatch(showToast({ message: 'Добавьте устройства, чтобы запустить симуляцию', severity: 'info' }));
      return;
    }
    setSimulationRunning(true);
    try {
      const response = await fetch(`${API_BASE}/api/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ devices, connections }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = (await response.json()) as SimulationResult;
      dispatch(setSimulation({ ...result, computed_by: 'server' }));
    } catch {
      // Сервер недоступен — считаем в браузере, чтобы функция работала всегда
      const result = runSimulation(devices, connections);
      dispatch(setSimulation(result));
      dispatch(showToast({ message: 'Сервер недоступен — выполнен локальный расчёт', severity: 'info' }));
    } finally {
      setSimulationRunning(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={handleOpenFile}
      />

      <AppBar position="static" sx={{ bgcolor: '#0d1117', borderBottom: '1px solid #30363d' }} elevation={0}>
        <Toolbar variant="dense" sx={{ gap: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, mr: 2, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            ⚡ AV-Tracer
          </Typography>

          <ButtonGroup variant="outlined" size="small">
            <Button startIcon={<FolderOpenIcon />} onClick={() => fileInputRef.current?.click()}>
              Открыть
            </Button>
            <Button startIcon={<SaveIcon />} onClick={handleSave}>
              Сохранить
            </Button>
          </ButtonGroup>

          <Divider orientation="vertical" flexItem sx={{ mx: 1, borderColor: '#30363d' }} />

          <Tooltip title="Отменить (Ctrl+Z)">
            <span>
              <IconButton size="small" onClick={() => dispatch(undo())} disabled={!canUndo}>
                <UndoIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Повторить">
            <span>
              <IconButton size="small" onClick={() => dispatch(redo())} disabled={!canRedo}>
                <RedoIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>

          <Box sx={{ flexGrow: 1 }} />

          <Button
            variant="contained"
            color="success"
            size="small"
            startIcon={<PlayArrowIcon />}
            onClick={handleSimulate}
            disabled={simulationRunning}
          >
            {simulationRunning ? 'Идёт расчёт…' : 'Симуляция'}
          </Button>
          <Button variant="outlined" color="error" size="small" startIcon={<DeleteIcon />} onClick={handleClear}>
            Очистить
          </Button>
        </Toolbar>
      </AppBar>

      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Drawer
          variant="permanent"
          sx={{
            width: 280,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: 280,
              boxSizing: 'border-box',
              position: 'relative',
              bgcolor: '#161b22',
              borderRight: '1px solid #30363d',
            },
          }}
        >
          <EquipmentLibrary />
        </Drawer>

        <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <CanvasWorkspace />
        </Box>

        <Drawer
          variant="permanent"
          anchor="right"
          sx={{
            width: 320,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: 320,
              boxSizing: 'border-box',
              position: 'relative',
              bgcolor: '#161b22',
              borderLeft: '1px solid #30363d',
            },
          }}
        >
          <PropertiesPanel />
        </Drawer>
      </Box>

      {/* Статус-бар */}
      <Box
        sx={{
          px: 2,
          py: 0.75,
          bgcolor: '#0d1117',
          borderTop: '1px solid #30363d',
          display: 'flex',
          gap: 3,
          fontSize: '0.8rem',
          color: 'text.secondary',
        }}
      >
        <span>Устройств: {devices.length}</span>
        <span>Соединений: {connections.length}</span>
        <span style={{ marginLeft: 'auto', opacity: 0.7 }}>
          Удалить — Delete · Отмена — Esc · Зум — колесо мыши
        </span>
      </Box>

      <SimulationPanel />

      <Snackbar
        open={!!toast}
        autoHideDuration={2600}
        onClose={() => dispatch(clearToast())}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        {toast ? (
          <Alert severity={toast.severity} variant="filled" onClose={() => dispatch(clearToast())} sx={{ width: '100%' }}>
            {toast.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
};

export default MainLayout;
