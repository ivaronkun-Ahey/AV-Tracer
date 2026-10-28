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

// Список листов дублирует drawingSet.ts, чтобы модуль чертежей (pdf-lib, ELK)
// загружался только при выпуске PDF, а не при открытии диалога
const KINDS: Array<{ kind: DrawingKind; title: string }> = [
  { kind: 'structural', title: 'Схема структурная' },
  { kind: 'functional', title: 'Схема функциональная' },
  { kind: 'connections', title: 'Схема соединений' },
  { kind: 'cables', title: 'Кабельный журнал' },
  { kind: 'spec', title: 'Спецификация оборудования (ГОСТ 21.110)' },
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

const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

/**
 * Имя файла — латиницей: браузеры (по крайней мере Chromium без окна) не всегда
 * принимают кириллицу в имени скачиваемого файла и подставляют «download».
 */
const safeName = (s: string) =>
  [...s]
    .map((ch) => {
      const lower = ch.toLowerCase();
      if (!(lower in TRANSLIT)) return ch;
      const t = TRANSLIT[lower];
      return ch === lower ? t : t.toUpperCase();
    })
    .join('')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '');

/** Выпуск комплекта чертежей в PDF: данные штампа, состав листов, формат. */
const DrawingExportDialog: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const dispatch = useAppDispatch();
  const devices = useAppSelector((s) => s.canvas.devices);
  const connections = useAppSelector((s) => s.canvas.connections);
  const rooms = useAppSelector((s) => s.canvas.rooms);
  const meta = useAppSelector((s) => s.canvas.meta);
  const [form, setForm] = useState<ProjectMeta>(meta);
  const [kinds, setKinds] = useState<DrawingKind[]>(KINDS.map((k) => k.kind));
  const [format, setFormat] = useState<SheetFormat | 'auto'>('auto');
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
    try {
      const [{ buildDrawingPdf }, { fetchDrawingFonts }] = await Promise.all([import('../drawing/drawingSet'), import('../drawing/pdf')]);
      const fonts = await fetchDrawingFonts();
      const result = await buildDrawingPdf({ devices, connections, rooms, meta: form }, { kinds, format }, fonts);
      const name = `${safeName(form.code || 'av-tracer') || 'av-tracer'}-chertezhi-${dateStamp()}.pdf`;
      downloadFile(name, new Blob([new Uint8Array(result.bytes)], { type: 'application/pdf' }));
      dispatch(
        showToast(
          result.notes.length
            ? { message: `PDF сформирован (листов: ${result.sheets}); ${result.notes.join('; ')}`, severity: 'warning' }
            : { message: `PDF сформирован, листов: ${result.sheets}`, severity: 'success' }
        )
      );
      onClose();
    } catch (e) {
      setError(`Не удалось сформировать PDF: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Чертежи (PDF, ГОСТ СПДС)</DialogTitle>
      <DialogContent dividers>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Основная надпись (форма 3 по ГОСТ Р 21.101)
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5, mb: 2 }}>
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
          {KINDS.map((k) => (
            <FormControlLabel
              key={k.kind}
              control={<Checkbox size="small" checked={kinds.includes(k.kind)} onChange={() => toggle(k.kind)} />}
              label={k.title}
            />
          ))}
        </Box>
        <TextField
          select
          size="small"
          label="Формат листов схем"
          value={format}
          onChange={(e) => setFormat(e.target.value as SheetFormat | 'auto')}
          SelectProps={{ native: true }}
          InputLabelProps={{ shrink: true }}
          helperText="«Авто» — наименьший формат, на котором текст не мельче 2,5 мм. Таблицы — на А3."
          sx={{ minWidth: 240 }}
        >
          <option value="auto">Авто</option>
          {(['A4', 'A3', 'A2', 'A1'] as SheetFormat[]).map((f) => (
            <option key={f} value={f}>
              {f.replace('A', 'А')}
            </option>
          ))}
        </TextField>
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
          disabled={busy || kinds.length === 0 || devices.length === 0}
          startIcon={busy ? <CircularProgress size={16} /> : undefined}
        >
          Сформировать PDF
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DrawingExportDialog;
