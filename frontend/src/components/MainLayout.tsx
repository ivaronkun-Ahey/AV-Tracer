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
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SaveIcon from '@mui/icons-material/Save';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import DeleteIcon from '@mui/icons-material/Delete';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ImageIcon from '@mui/icons-material/Image';
import PrintIcon from '@mui/icons-material/Print';
import TableChartIcon from '@mui/icons-material/TableChart';
import CableIcon from '@mui/icons-material/Cable';
import CheckIcon from '@mui/icons-material/Check';
import ExportStage from './ExportStage';
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
  setDevicePositions,
  requestFit,
  toggleSnapToGrid,
  toggleCableLabels,
  showToast,
  clearToast,
} from '../features/canvasSlice';
import { computeAutoLayout } from '../features/autoLayout';
import {
  bomCsv,
  cableScheduleCsv,
  dateStamp,
  documentationHtml,
  downloadDataUrl,
  downloadFile,
} from '../features/exportDocs';
import { EXAMPLE_PROJECTS } from '../data/examples';
import { runSimulation } from '../sim/engine';
import { parseProjectDoc, serializeProject, PROJECT_LIMITS } from '../data/projectSchema';


const MainLayout: React.FC = () => {
  const dispatch = useAppDispatch();
  const devices = useAppSelector((s) => s.canvas.devices);
  const connections = useAppSelector((s) => s.canvas.connections);
  const canUndo = useAppSelector((s) => s.canvas.past.length > 0);
  const canRedo = useAppSelector((s) => s.canvas.future.length > 0);
  const toast = useAppSelector((s) => s.canvas.toast);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const snapToGrid = useAppSelector((s) => s.canvas.snapToGrid);
  const showCableLabels = useAppSelector((s) => s.canvas.showCableLabels);
  const [menu, setMenu] = useState<{ name: 'examples' | 'view' | 'export'; anchor: HTMLElement } | null>(null);
  const [layoutRunning, setLayoutRunning] = useState(false);
  const [exportJob, setExportJob] = useState<{ kind: 'png' | 'print'; win: Window | null } | null>(null);
  const openMenu = (name: 'examples' | 'view' | 'export') => (e: React.MouseEvent<HTMLElement>) =>
    setMenu({ name, anchor: e.currentTarget });
  const closeMenu = () => setMenu(null);

  const handleExample = (id: string) => {
    closeMenu();
    const example = EXAMPLE_PROJECTS.find((x) => x.id === id);
    if (!example) return;
    if (devices.length > 0 && !confirm('Заменить текущую схему примером? Отменить можно через Ctrl+Z.')) return;
    dispatch(loadProject(example.build()));
    dispatch(requestFit());
    dispatch(showToast({ message: `Загружен пример: ${example.name}`, severity: 'success' }));
  };

  const handleAutoLayout = async () => {
    if (devices.length === 0) return;
    setLayoutRunning(true);
    try {
      dispatch(setDevicePositions(await computeAutoLayout(devices, connections)));
      dispatch(requestFit());
      dispatch(showToast({ message: 'Схема упорядочена по ходу сигнала · Ctrl+Z — вернуть как было', severity: 'success' }));
    } catch {
      dispatch(showToast({ message: 'Не удалось упорядочить схему', severity: 'error' }));
    } finally {
      setLayoutRunning(false);
    }
  };

  const startExport = (kind: 'png' | 'print' | 'bom' | 'cables') => {
    closeMenu();
    if (devices.length === 0) {
      dispatch(showToast({ message: 'Схема пуста — экспортировать нечего', severity: 'info' }));
      return;
    }
    if (kind === 'bom') {
      downloadFile(`av-tracer-bom-${dateStamp()}.csv`, bomCsv(devices));
      return;
    }
    if (kind === 'cables') {
      downloadFile(`av-tracer-cables-${dateStamp()}.csv`, cableScheduleCsv(devices, connections));
      return;
    }
    // Окно для печати открываем сразу по клику, иначе браузер заблокирует всплывающее окно
    const win = kind === 'print' ? window.open('', '_blank') : null;
    if (kind === 'print' && !win) {
      dispatch(showToast({ message: 'Браузер заблокировал новое окно — разрешите всплывающие окна', severity: 'warning' }));
      return;
    }
    win?.document.write('<p style="font-family: sans-serif">Готовим документ…</p>');
    setExportJob({ kind, win });
  };

  const finishExport = (dataUrl: string) => {
    const job = exportJob;
    setExportJob(null);
    if (!job) return;
    if (job.kind === 'png') {
      downloadDataUrl(`av-tracer-schema-${dateStamp()}.png`, dataUrl);
      dispatch(showToast({ message: 'Схема сохранена в PNG', severity: 'success' }));
    } else if (job.win) {
      job.win.document.open();
      job.win.document.write(documentationHtml(dataUrl, devices, connections));
      job.win.document.close();
    }
  };

  const handleClear = () => {
    if (devices.length === 0) return;
    if (confirm('Очистить весь холст? Все устройства и соединения будут удалены.')) {
      dispatch(clearCanvas());
    }
  };

  const handleSave = () => {
    const project = { ...serializeProject(devices, connections), timestamp: new Date().toISOString() };
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
    if (file.size > PROJECT_LIMITS.fileBytes) {
      dispatch(showToast({ message: 'Файл слишком большой для проекта AV-Tracer (больше 5 МБ)', severity: 'error' }));
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      let raw: unknown;
      try {
        raw = JSON.parse(String(reader.result));
      } catch {
        dispatch(showToast({ message: 'Не удалось открыть файл: это не JSON', severity: 'error' }));
        return;
      }
      const parsed = parseProjectDoc(raw);
      if (!parsed.ok) {
        dispatch(showToast({ message: `Не удалось открыть файл: ${parsed.error}`, severity: 'error' }));
        return;
      }
      dispatch(loadProject({ devices: parsed.devices, connections: parsed.connections }));
      const remarks = [
        ...parsed.notes,
        ...(parsed.droppedConnections > 0
          ? [`пропущено соединений с несуществующими портами: ${parsed.droppedConnections}`]
          : []),
      ];
      dispatch(
        showToast(
          remarks.length > 0
            ? { message: `Проект загружен; ${remarks.join('; ')}`, severity: 'warning' }
            : { message: 'Проект загружен', severity: 'success' }
        )
      );
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Симуляция считается в браузере: мгновенно и без сервера
  const handleSimulate = () => {
    if (devices.length === 0) {
      dispatch(showToast({ message: 'Добавьте устройства, чтобы запустить симуляцию', severity: 'info' }));
      return;
    }
    dispatch(setSimulation(runSimulation(devices, connections)));
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

          <Divider orientation="vertical" flexItem sx={{ mx: 1, borderColor: '#30363d' }} />

          <Button size="small" startIcon={<AutoAwesomeIcon />} onClick={openMenu('examples')}>
            Примеры
          </Button>
          <Tooltip title="Расставить устройства по ходу сигнала: источники слева, приёмники справа">
            <span>
              <Button
                size="small"
                startIcon={<AccountTreeIcon />}
                onClick={handleAutoLayout}
                disabled={devices.length === 0 || layoutRunning}
              >
                Упорядочить
              </Button>
            </span>
          </Tooltip>
          <Button size="small" startIcon={<VisibilityIcon />} onClick={openMenu('view')}>
            Вид
          </Button>
          <Button size="small" startIcon={<FileDownloadIcon />} onClick={openMenu('export')}>
            Экспорт
          </Button>

          <Box sx={{ flexGrow: 1 }} />

          <Button
            variant="contained"
            color="success"
            size="small"
            startIcon={<PlayArrowIcon />}
            onClick={handleSimulate}
          >
            Симуляция
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
          Входы — слева, выходы — справа · Удалить — Delete · Отмена — Esc · Зум — колесо мыши
        </span>
      </Box>

      <SimulationPanel />

      <Menu anchorEl={menu?.anchor} open={menu?.name === 'examples'} onClose={closeMenu}>
        {EXAMPLE_PROJECTS.map((ex) => (
          <MenuItem key={ex.id} onClick={() => handleExample(ex.id)}>
            <ListItemText primary={ex.name} secondary={ex.description} />
          </MenuItem>
        ))}
      </Menu>

      <Menu anchorEl={menu?.anchor} open={menu?.name === 'view'} onClose={closeMenu}>
        <MenuItem onClick={() => dispatch(toggleSnapToGrid())}>
          <ListItemIcon>{snapToGrid && <CheckIcon fontSize="small" />}</ListItemIcon>
          <ListItemText primary="Привязка к сетке" />
        </MenuItem>
        <MenuItem onClick={() => dispatch(toggleCableLabels())}>
          <ListItemIcon>{showCableLabels && <CheckIcon fontSize="small" />}</ListItemIcon>
          <ListItemText primary="Подписи кабелей" secondary="маркировка и длина" />
        </MenuItem>
      </Menu>

      <Menu anchorEl={menu?.anchor} open={menu?.name === 'export'} onClose={closeMenu}>
        <MenuItem onClick={() => startExport('png')}>
          <ListItemIcon>
            <ImageIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Схема (PNG)" secondary="светлая тема, по габаритам схемы" />
        </MenuItem>
        <MenuItem onClick={() => startExport('print')}>
          <ListItemIcon>
            <PrintIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Документация (печать / PDF)" secondary="схема со штампом, спецификация, кабели" />
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => startExport('bom')}>
          <ListItemIcon>
            <TableChartIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Спецификация оборудования (CSV)" />
        </MenuItem>
        <MenuItem onClick={() => startExport('cables')}>
          <ListItemIcon>
            <CableIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Кабельный журнал (CSV)" />
        </MenuItem>
      </Menu>

      {exportJob && (
        <ExportStage
          devices={devices}
          connections={connections}
          showCableLabels={showCableLabels}
          onRendered={finishExport}
        />
      )}

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
