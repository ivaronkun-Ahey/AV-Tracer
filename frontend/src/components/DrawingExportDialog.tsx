import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  FormControlLabel,
  Checkbox,
  Box,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useAppDispatch, useAppSelector } from '../store';
import { setProjectMeta, showToast } from '../features/canvasSlice';
import { ProjectMeta } from '../types/device.types';
import { dateStamp, downloadFile } from '../features/exportDocs';
import type { DrawingKind } from '../drawing/drawingSet';
import type { SheetFormat } from '../drawing/sheet';
import { safeFileName } from '../drawing/translit';

// Список листов дублирует drawingSet.ts, чтобы модуль чертежей (pdf-lib, ELK)
// загружался только при выпуске чертежей, а не при открытии диалога
const KINDS: Array<{ kind: DrawingKind; title: string }> = [
  { kind: 'structural', title: 'Схема структурная' },
  { kind: 'functional', title: 'Схема функциональная' },
  { kind: 'connections', title: 'Схема соединений' },
  { kind: 'racks', title: 'Схема расположения оборудования в шкафах' },
  { kind: 'plan', title: 'План расположения оборудования' },
  { kind: 'cables', title: 'Кабельный журнал' },
  { kind: 'spec', title: 'Спецификация оборудования (ГОСТ 21.110)' },
];

type Output = 'pdf' | 'svg' | 'dxf' | 'vsdx';

const OUTPUTS: Array<{ value: Output; label: string; hint: string }> = [
  {
    value: 'pdf',
    label: 'PDF',
    hint: 'Комплект в одном файле — для печати и согласования.',
  },
  {
    value: 'svg',
    label: 'SVG',
    hint: 'Векторный лист для правки в Inkscape, Illustrator, Visio; несколько листов — ZIP-архив.',
  },
  {
    value: 'dxf',
    label: 'DXF',
    hint: 'DXF R12 для AutoCAD, nanoCAD, LibreCAD: все листы в одном файле, линии по слоям AV_THICK (0,6 мм), AV_THIN (0,25 мм), текст — AV_TEXT.',
  },
  {
    value: 'vsdx',
    label: 'VSDX',
    hint: 'Документ Visio (открывается и в LibreOffice Draw): лист — страница в натуральную величину, шрифт Arial Narrow.',
  },
];

const FIELDS: Array<{ key: keyof ProjectMeta; label: string; wide?: boolean }> = [
  { key: 'code', label: 'Обозначение (шифр)' },
  { key: 'stage', label: 'Стадия (П, Р)' },
  { key: 'object', label: 'Наименование объекта', wide: true },
  { key: 'building', label: 'Здание, сооружение', wide: true },
  { key: 'organization', label: 'Организация', wide: true },
  { key: 'developer', label: 'Разработал' },
  { key: 'checker', label: 'Проверил' },
  { key: 'normControl', label: 'Нормоконтроль' },
  { key: 'chiefEngineer', label: 'ГИП' },
];

/** Выпуск комплекта чертежей (PDF, SVG, DXF, VSDX): данные штампа, состав листов, формат. */
const DrawingExportDialog: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const dispatch = useAppDispatch();
  const devices = useAppSelector((s) => s.canvas.devices);
  const connections = useAppSelector((s) => s.canvas.connections);
  const rooms = useAppSelector((s) => s.canvas.rooms);
  const racks = useAppSelector((s) => s.canvas.racks);
  const hasPlan = devices.some((d) => d.plan);
  const meta = useAppSelector((s) => s.canvas.meta);
  const [form, setForm] = useState<ProjectMeta>(meta);
  const [kinds, setKinds] = useState<DrawingKind[]>(KINDS.map((k) => k.kind));
  const [format, setFormat] = useState<SheetFormat | 'auto'>('auto');
  const [output, setOutput] = useState<Output>('pdf');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm({ stage: 'Р', ...meta });
      setError('');
    }
    // Форма заполняется при каждом открытии из данных проекта
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggle = (kind: DrawingKind) => setKinds((ks) => (ks.includes(kind) ? ks.filter((k) => k !== kind) : [...ks, kind]));

  const generate = async () => {
    setBusy(true);
    setError('');
    // Данные штампа сохраняются в проекте — в следующий раз заполнять не нужно
    dispatch(setProjectMeta(form));
    const label = OUTPUTS.find((o) => o.value === output)!.label;
    try {
      const [set, { fetchDrawingFonts }] = await Promise.all([import('../drawing/drawingSet'), import('../drawing/textkit')]);
      const fonts = await fetchDrawingFonts();
      const doc = { devices, connections, rooms, racks, meta: form };
      const base = `${safeFileName(form.code || 'av-tracer') || 'av-tracer'}-chertezhi-${dateStamp()}`;
      let file: { name: string; type: string };
      let result: { bytes: Uint8Array; sheets: number; notes: string[] };
      if (output === 'svg') {
        const svg = await set.buildDrawingSvg(doc, { kinds, format }, fonts);
        result = svg;
        file = svg.zip ? { name: `${base}-svg.zip`, type: 'application/zip' } : { name: `${base}.svg`, type: 'image/svg+xml' };
      } else if (output === 'dxf') {
        result = await set.buildDrawingDxf(doc, { kinds, format }, fonts);
        file = { name: `${base}.dxf`, type: 'image/vnd.dxf' };
      } else if (output === 'vsdx') {
        result = await set.buildDrawingVsdx(doc, { kinds, format }, fonts);
        file = { name: `${base}.vsdx`, type: 'application/vnd.ms-visio.drawing' };
      } else {
        result = await set.buildDrawingPdf(doc, { kinds, format }, fonts);
        file = { name: `${base}.pdf`, type: 'application/pdf' };
      }
      downloadFile(file.name, new Blob([new Uint8Array(result.bytes)], { type: file.type }));
      dispatch(
        showToast(
          result.notes.length
            ? {
                message: `${label} сформирован (листов: ${result.sheets}); ${result.notes.join('; ')}`,
                severity: 'warning',
              }
            : {
                message: `${label} сформирован, листов: ${result.sheets}`,
                severity: 'success',
              }
        )
      );
      onClose();
    } catch (e) {
      setError(`Не удалось сформировать ${label}: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Чертежи (ГОСТ СПДС)</DialogTitle>
      <DialogContent dividers>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Основная надпись (форма 3 по ГОСТ Р 21.101)
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 1.5,
            mb: 2,
          }}
        >
          {FIELDS.map((f) => (
            <TextField
              key={f.key}
              size="small"
              label={f.label}
              value={form[f.key] ?? ''}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              inputProps={{ maxLength: f.key === 'stage' ? 10 : 200 }}
              sx={f.wide ? { gridColumn: { sm: '1 / -1' } } : undefined}
            />
          ))}
        </Box>
        <Typography variant="subtitle2" color="text.secondary">
          Листы
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', mb: 1 }}>
          {KINDS.filter((k) => (k.kind !== 'racks' || racks.length > 0) && (k.kind !== 'plan' || hasPlan)).map((k) => (
            <FormControlLabel
              key={k.kind}
              control={<Checkbox size="small" checked={kinds.includes(k.kind)} onChange={() => toggle(k.kind)} />}
              label={k.title}
            />
          ))}
        </Box>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 2,
            alignItems: 'flex-start',
          }}
        >
          <TextField
            select
            size="small"
            label="Файл"
            value={output}
            onChange={(e) => setOutput(e.target.value as Output)}
            SelectProps={{ native: true }}
            InputLabelProps={{ shrink: true }}
            helperText={OUTPUTS.find((o) => o.value === output)!.hint}
            sx={{ flex: '1 1 240px' }}
          >
            {OUTPUTS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Формат листов схем"
            value={format}
            onChange={(e) => setFormat(e.target.value as SheetFormat | 'auto')}
            SelectProps={{ native: true }}
            InputLabelProps={{ shrink: true }}
            helperText="«Авто» — наименьший формат, на котором текст не мельче 2,5 мм. Таблицы — на А3."
            sx={{ flex: '1 1 240px' }}
          >
            <option value="auto">Авто</option>
            {(['A4', 'A3', 'A2', 'A1'] as SheetFormat[]).map((f) => (
              <option key={f} value={f}>
                {f.replace('A', 'А')}
              </option>
            ))}
          </TextField>
        </Box>
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Отмена
        </Button>
        <Button
          variant="contained"
          onClick={generate}
          disabled={
            busy || kinds.every((k) => (k === 'racks' && racks.length === 0) || (k === 'plan' && !hasPlan)) || devices.length === 0
          }
          startIcon={busy ? <CircularProgress size={16} /> : undefined}
        >
          Сформировать {OUTPUTS.find((o) => o.value === output)!.label}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DrawingExportDialog;
