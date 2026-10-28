import React, { useRef, useState } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Button,
  ButtonGroup,
  Snackbar,
  Alert,
  Tooltip,
  IconButton,
  Divider,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  useMediaQuery,
  useTheme,
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
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import TuneIcon from '@mui/icons-material/Tune';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ExportStage from './ExportStage';
import AutosaveIndicator from './AutosaveIndicator';
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

type PanelName = 'library' | 'properties';
type MenuName = 'examples' | 'view' | 'export' | 'more';
type PanelState = Record<PanelName, boolean>;
const PANELS_KEY = 'av-tracer:panels';

/** Какие панели открыты на широком экране — удобство конкретного браузера. */
function loadPanels(): PanelState {
  try {
    const raw = JSON.parse(localStorage.getItem(PANELS_KEY) || '{}');
    return { library: raw.library !== false, properties: raw.properties !== false };
  } catch {
    return { library: true, properties: true };
  }
}

function savePanels(state: PanelState) {
  try {
    localStorage.setItem(PANELS_KEY, JSON.stringify(state));
  } catch {
    /* хранилище недоступно — панели просто откроются по умолчанию */
  }
}

/** Кнопка панели инструментов: на узком экране — только значок с подсказкой. */
const ToolButton: React.FC<{
  compact: boolean;
  icon: React.ReactNode;
  label: string;
  tooltip?: string;
  onClick: (e: React.MouseEvent<HTMLElement>) => void;
  disabled?: boolean;
  pressed?: boolean;
}> = ({ compact, icon, label, tooltip, onClick, disabled, pressed }) => {
  const button = compact ? (
    <IconButton size="small" aria-label={label} aria-pressed={pressed} onClick={onClick} disabled={disabled}>
      {icon}
    </IconButton>
  ) : (
    <Button size="small" startIcon={icon} aria-pressed={pressed} onClick={onClick} disabled={disabled}>
      {label}
    </Button>
  );
  if (!compact && !tooltip) return button;
  return (
    <Tooltip title={tooltip ?? label}>
      <span style={{ flexShrink: 0 }}>{button}</span>
    </Tooltip>
  );
};

const MainLayout: React.FC = () => {
  const dispatch = useAppDispatch();
  const devices = useAppSelector((s) => s.canvas.devices);
  const connections = useAppSelector((s) => s.canvas.connections);
  const rooms = useAppSelector((s) => s.canvas.rooms);
  const canUndo = useAppSelector((s) => s.canvas.past.length > 0);
  const canRedo = useAppSelector((s) => s.canvas.future.length > 0);
  const toast = useAppSelector((s) => s.canvas.toast);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const snapToGrid = useAppSelector((s) => s.canvas.snapToGrid);
  const showCableLabels = useAppSelector((s) => s.canvas.showCableLabels);
  const [menu, setMenu] = useState<{ name: MenuName; anchor: HTMLElement } | null>(null);
  const [layoutRunning, setLayoutRunning] = useState(false);
  const [exportJob, setExportJob] = useState<{ kind: 'png' | 'print'; win: Window | null } | null>(null);

  // Если хватает ширины, панель стоит сбоку от холста и сворачивается (библиотека —
  // от 900 px, свойства — от 1200 px). Иначе открывается поверх холста по кнопке,
  // по одной, и по умолчанию закрыта.
  const theme = useTheme();
  const wide = useMediaQuery(theme.breakpoints.up('lg'), { noSsr: true });
  const medium = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true });
  const phone = !useMediaQuery(theme.breakpoints.up('sm'), { noSsr: true });
  const compact = !wide;
  const dockable: PanelState = { library: medium, properties: wide };
  const [docked, setDocked] = useState<PanelState>(loadPanels);
  const [overlay, setOverlay] = useState<PanelName | null>(null);
  const isOpen = (name: PanelName) => (dockable[name] ? docked[name] : overlay === name);
  const togglePanel = (name: PanelName) => {
    if (dockable[name]) {
      const next = { ...docked, [name]: !docked[name] };
      setDocked(next);
      savePanels(next);
    } else {
      setOverlay(overlay === name ? null : name);
    }
  };
  const panelSx = (name: PanelName, side: 'left' | 'right', width: number) => ({
    width,
    flexShrink: 0,
    bgcolor: '#161b22',
    [side === 'left' ? 'borderRight' : 'borderLeft']: '1px solid #30363d',
    ...(dockable[name]
      ? {}
      : { position: 'absolute' as const, top: 0, bottom: 0, [side]: 0, zIndex: 10, width: `min(${width}px, 88vw)`, boxShadow: 8 }),
  });
  const openMenu = (name: MenuName) => (e: React.MouseEvent<HTMLElement>) =>
    setMenu({ name, anchor: e.currentTarget });
  // Пункт меню «Ещё» открывает вложенное меню на том же месте
  const switchMenu = (name: MenuName) => setMenu((m) => (m ? { name, anchor: m.anchor } : null));
  const openFile = () => {
    closeMenu();
    fileInputRef.current?.click();
  };
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
      downloadFile(`av-tracer-bom-${dateStamp()}.csv`, bomCsv(devices, rooms));
      return;
    }
    if (kind === 'cables') {
      downloadFile(`av-tracer-cables-${dateStamp()}.csv`, cableScheduleCsv(devices, connections, rooms));
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
      const win = job.win;
      win.document.open();
      win.document.write(documentationHtml(dataUrl, { devices, connections, rooms }));
      win.document.close();
      // Печать вызывает само приложение: встроенные скрипты в документе запрещены
      // политикой безопасности (CSP), а диалог печати открывается после загрузки схемы
      const img = win.document.querySelector('img');
      const print = () => win.print();
      if (img && !img.complete) img.addEventListener('load', print, { once: true });
      else setTimeout(print, 100);
    }
  };

  const handleClear = () => {
    if (devices.length === 0) return;
    if (confirm('Очистить весь холст? Все устройства и соединения будут удалены.')) {
      dispatch(clearCanvas());
    }
  };

  const handleSave = () => {
    const project = { ...serializeProject({ devices, connections, rooms }), timestamp: new Date().toISOString() };
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
      dispatch(loadProject({ devices: parsed.devices, connections: parsed.connections, rooms: parsed.rooms }));
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
        <Toolbar variant="dense" sx={{ gap: phone ? 0.5 : 1, overflowX: 'auto', '& > *': { flexShrink: 0 } }}>
          <ToolButton
            compact
            icon={<LibraryBooksIcon fontSize="small" />}
            label={isOpen('library') ? 'Скрыть библиотеку' : 'Показать библиотеку'}
            pressed={isOpen('library')}
            onClick={() => togglePanel('library')}
          />
          <Typography variant="h6" sx={{ fontWeight: 800, mr: { xs: 0, lg: 2 }, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            ⚡<Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>AV-Tracer</Box>
          </Typography>

          {!phone &&
            (compact ? (
              <>
                <ToolButton compact icon={<FolderOpenIcon fontSize="small" />} label="Открыть" onClick={openFile} />
                <ToolButton compact icon={<SaveIcon fontSize="small" />} label="Сохранить" onClick={handleSave} />
              </>
            ) : (
              <ButtonGroup variant="outlined" size="small">
                <Button startIcon={<FolderOpenIcon />} onClick={openFile}>
                  Открыть
                </Button>
                <Button startIcon={<SaveIcon />} onClick={handleSave}>
                  Сохранить
                </Button>
              </ButtonGroup>
            ))}

          {!phone && <Divider orientation="vertical" flexItem sx={{ mx: 1, borderColor: '#30363d' }} />}

          <ToolButton
            compact
            icon={<UndoIcon fontSize="small" />}
            label="Отменить"
            tooltip="Отменить (Ctrl+Z)"
            onClick={() => dispatch(undo())}
            disabled={!canUndo}
          />
          <ToolButton
            compact
            icon={<RedoIcon fontSize="small" />}
            label="Повторить"
            tooltip="Повторить (Ctrl+Shift+Z)"
            onClick={() => dispatch(redo())}
            disabled={!canRedo}
          />

          {!phone && (
            <>
              <Divider orientation="vertical" flexItem sx={{ mx: 1, borderColor: '#30363d' }} />
              <ToolButton compact={compact} icon={<AutoAwesomeIcon fontSize="small" />} label="Примеры" onClick={openMenu('examples')} />
              <ToolButton
                compact={compact}
                icon={<AccountTreeIcon fontSize="small" />}
                label="Упорядочить"
                tooltip="Расставить устройства по ходу сигнала: источники слева, приёмники справа"
                onClick={handleAutoLayout}
                disabled={devices.length === 0 || layoutRunning}
              />
              <ToolButton compact={compact} icon={<VisibilityIcon fontSize="small" />} label="Вид" onClick={openMenu('view')} />
              <ToolButton compact={compact} icon={<FileDownloadIcon fontSize="small" />} label="Экспорт" onClick={openMenu('export')} />
            </>
          )}

          <Box sx={{ flexGrow: 1 }} />

          {phone ? (
            <Tooltip title="Симуляция">
              <IconButton
                size="small"
                aria-label="Симуляция"
                onClick={handleSimulate}
                sx={{ bgcolor: 'success.main', color: '#fff', '&:hover': { bgcolor: 'success.dark' } }}
              >
                <PlayArrowIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : (
            <Button variant="contained" color="success" size="small" startIcon={<PlayArrowIcon />} onClick={handleSimulate}>
              Симуляция
            </Button>
          )}
          {!phone &&
            (compact ? (
              <ToolButton compact icon={<DeleteIcon fontSize="small" />} label="Очистить" onClick={handleClear} />
            ) : (
              <Button variant="outlined" color="error" size="small" startIcon={<DeleteIcon />} onClick={handleClear}>
                Очистить
              </Button>
            ))}
          <ToolButton
            compact
            icon={<TuneIcon fontSize="small" />}
            label={isOpen('properties') ? 'Скрыть свойства' : 'Показать свойства'}
            pressed={isOpen('properties')}
            onClick={() => togglePanel('properties')}
          />
          {phone && <ToolButton compact icon={<MoreVertIcon fontSize="small" />} label="Ещё" onClick={openMenu('more')} />}
        </Toolbar>
      </AppBar>

      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Скрытая панель остаётся в DOM: поиск в библиотеке не сбрасывается */}
        <Box component="aside" aria-label="Библиотека оборудования" hidden={!isOpen('library')} sx={panelSx('library', 'left', 280)}>
          <EquipmentLibrary onAdded={() => !dockable.library && setOverlay(null)} />
        </Box>

        <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden', position: 'relative' }}>
          <CanvasWorkspace />
        </Box>

        <Box component="aside" aria-label="Свойства" hidden={!isOpen('properties')} sx={panelSx('properties', 'right', 320)}>
          <PropertiesPanel />
        </Box>
      </Box>

      {/* Статус-бар */}
      <Box
        sx={{
          px: 2,
          py: 0.75,
          bgcolor: '#0d1117',
          borderTop: '1px solid #30363d',
          display: 'flex',
          gap: { xs: 1.5, sm: 3 },
          fontSize: '0.8rem',
          color: 'text.secondary',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
        }}
      >
        <span>Устройств: {devices.length}</span>
        <span>Соединений: {connections.length}</span>
        <AutosaveIndicator />
        <Box component="span" sx={{ ml: 'auto', opacity: 0.7, display: { xs: 'none', lg: 'inline' } }}>
          Входы — слева, выходы — справа · Удалить — Delete · Отмена — Esc · Стрелки — сдвиг · Зум — колесо мыши
        </Box>
      </Box>

      <SimulationPanel />

      {/* На телефоне второстепенные действия собраны в меню «Ещё» */}
      <Menu anchorEl={menu?.anchor} open={menu?.name === 'more'} onClose={closeMenu}>
        <MenuItem onClick={openFile}>
          <ListItemIcon>
            <FolderOpenIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Открыть" />
        </MenuItem>
        <MenuItem
          onClick={() => {
            closeMenu();
            handleSave();
          }}
        >
          <ListItemIcon>
            <SaveIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Сохранить" />
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => switchMenu('examples')}>
          <ListItemIcon>
            <AutoAwesomeIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Примеры…" />
        </MenuItem>
        <MenuItem
          disabled={devices.length === 0 || layoutRunning}
          onClick={() => {
            closeMenu();
            handleAutoLayout();
          }}
        >
          <ListItemIcon>
            <AccountTreeIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Упорядочить" />
        </MenuItem>
        <MenuItem onClick={() => switchMenu('view')}>
          <ListItemIcon>
            <VisibilityIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Вид…" />
        </MenuItem>
        <MenuItem onClick={() => switchMenu('export')}>
          <ListItemIcon>
            <FileDownloadIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Экспорт…" />
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            closeMenu();
            handleClear();
          }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText primary="Очистить" />
        </MenuItem>
      </Menu>

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
          rooms={rooms}
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
