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
  Radio,
  RadioGroup,
  Box,
  Alert,
  Stack,
} from '@mui/material';
import { useStore } from 'react-redux';
import { RootState, useAppDispatch, useAppSelector } from '../store';
import { showToast } from '../features/canvasSlice';
import { saveCustomLessons } from '../features/lessonSlice';
import { LESSONS } from '../learning/lessons';
import type { DocSpec, Lesson } from '../learning/lessonSchema';
import { LessonDraft, StartMode, buildLesson, docToSpec, draftFromLesson, emptyDraft, suggestChecks } from '../learning/authoring';

const summary = (spec?: DocSpec) => (spec ? `устройств: ${spec.devices.length}, кабелей: ${spec.connections.length}` : 'не задано');

const START_MODES: Array<{ value: StartMode; label: string }> = [
  { value: 'empty', label: 'Пустой холст' },
  { value: 'devices', label: 'Устройства решения без кабелей' },
  { value: 'captured', label: 'Своя схема (например, с неисправностью)' },
];

/**
 * Редактор задания преподавателя: эталонное решение и стартовая схема берутся
 * с холста, проверки предлагаются по симуляции решения. Окно можно закрыть,
 * поменять схему и вернуться — черновик сохраняется до перезагрузки страницы.
 */
const LessonEditorDialog: React.FC<{ open: boolean; lesson?: Lesson; onClose: () => void }> = ({ open, lesson, onClose }) => {
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
  const custom = useAppSelector((s) => s.lesson.custom);
  const [draft, setDraft] = useState<LessonDraft>(emptyDraft);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setErrors([]);
    // Открыли другое задание или новое после правки — черновик заново
    if (lesson && draft.id !== lesson.id) setDraft(draftFromLesson(lesson));
    if (!lesson && draft.id) setDraft(emptyDraft());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lesson]);

  const patch = (p: Partial<LessonDraft>) => setDraft((d) => ({ ...d, ...p }));

  const capture = (): DocSpec | null => {
    const { devices, connections, rooms } = store.getState().canvas;
    if (devices.length === 0) {
      setErrors(['на холсте нет устройств — соберите схему']);
      return null;
    }
    try {
      setErrors([]);
      return docToSpec({ devices, connections, rooms });
    } catch (e) {
      setErrors([(e as Error).message]);
      return null;
    }
  };

  const takeSolution = () => {
    const spec = capture();
    if (!spec) return;
    patch({ solution: spec, checks: suggestChecks(spec).map((c) => ({ ...c, enabled: true })) });
  };

  const takeStart = () => {
    const spec = capture();
    if (spec) patch({ start: spec, startMode: 'captured' });
  };

  const save = () => {
    const taken = new Set([...LESSONS, ...custom].map((l) => l.id).filter((id) => id !== draft.id));
    const result = buildLesson(draft, taken);
    if (!result.lesson) {
      setErrors(result.errors);
      return;
    }
    dispatch(saveCustomLessons([result.lesson]));
    dispatch(showToast({ message: `Задание «${result.lesson.title}» сохранено — оно в разделе «Свои задания»`, severity: 'success' }));
    setDraft(emptyDraft());
    onClose();
  };

  const setKind = (kind: LessonDraft['kind']) => patch({ kind, startMode: kind === 'troubleshoot' ? 'captured' : draft.startMode });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{draft.id ? 'Правка задания' : 'Новое задание'}</DialogTitle>
      <DialogContent dividers>
        <Alert severity="info" sx={{ mb: 2 }}>
          Соберите на холсте правильную схему и возьмите её как эталонное решение. Для задания «Найдите неисправность» затем внесите
          неисправность (уберите кабель, измените настройку) и возьмите схему как стартовую. Окно можно закрыть и вернуться — черновик
          сохранится.
        </Alert>
        <RadioGroup row value={draft.kind} onChange={(e) => setKind(e.target.value as LessonDraft['kind'])} aria-label="Тип задания">
          <FormControlLabel value="build" control={<Radio size="small" />} label="Соберите систему" />
          <FormControlLabel value="troubleshoot" control={<Radio size="small" />} label="Найдите неисправность" />
        </RadioGroup>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 200px' }, gap: 1.5, my: 1.5 }}>
          <TextField
            size="small"
            label="Название"
            value={draft.title}
            onChange={(e) => patch({ title: e.target.value })}
            inputProps={{ maxLength: 80 }}
          />
          <TextField
            select
            size="small"
            label="Сложность"
            value={draft.level}
            onChange={(e) => patch({ level: Number(e.target.value) as LessonDraft['level'] })}
            SelectProps={{ native: true }}
            InputLabelProps={{ shrink: true }}
          >
            <option value={1}>Начальный</option>
            <option value={2}>Средний</option>
            <option value={3}>Продвинутый</option>
          </TextField>
        </Box>
        <Stack spacing={1.5}>
          <TextField
            size="small"
            label="Цель задания"
            multiline
            minRows={2}
            value={draft.goal}
            onChange={(e) => patch({ goal: e.target.value })}
          />
          <TextField
            size="small"
            label="Теория"
            multiline
            minRows={2}
            value={draft.theory}
            onChange={(e) => patch({ theory: e.target.value })}
          />
          <TextField
            size="small"
            label="Подсказки"
            helperText="По одной на строку — ученик открывает их по очереди"
            multiline
            minRows={3}
            value={draft.hints}
            onChange={(e) => patch({ hints: e.target.value })}
          />
        </Stack>

        <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2 }}>
          Эталонное решение
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="body2" aria-label="Эталонное решение">
            {summary(draft.solution)}
          </Typography>
          <Button size="small" variant="outlined" onClick={takeSolution}>
            Взять текущую схему как решение
          </Button>
        </Box>

        <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2 }}>
          Стартовая схема — что ученик видит в начале
        </Typography>
        <RadioGroup
          value={draft.startMode}
          onChange={(e) => patch({ startMode: e.target.value as StartMode })}
          aria-label="Стартовая схема"
        >
          {START_MODES.map((m) => (
            <FormControlLabel key={m.value} value={m.value} control={<Radio size="small" />} label={m.label} />
          ))}
        </RadioGroup>
        {draft.startMode === 'captured' && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', ml: 4 }}>
            <Typography variant="body2" aria-label="Своя стартовая схема">
              {summary(draft.start)}
            </Typography>
            <Button size="small" variant="outlined" onClick={takeStart}>
              Взять текущую схему как стартовую
            </Button>
          </Box>
        )}
        <FormControlLabel
          sx={{ mt: 1 }}
          control={<Checkbox size="small" checked={draft.limitPalette} onChange={(e) => patch({ limitPalette: e.target.checked })} />}
          label="В библиотеке — только оборудование задания"
        />

        <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2 }}>
          Проверки {draft.solution ? '(предложены по симуляции решения; текст можно изменить)' : '— появятся, когда задано решение'}
        </Typography>
        <Stack spacing={1} sx={{ mt: 1 }} aria-label="Проверки">
          {draft.checks.map((c, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Checkbox
                size="small"
                checked={c.enabled}
                inputProps={{ 'aria-label': `Проверка: ${c.text}` }}
                onChange={(e) => patch({ checks: draft.checks.map((x, j) => (j === i ? { ...x, enabled: e.target.checked } : x)) })}
              />
              <TextField
                size="small"
                fullWidth
                value={c.text}
                disabled={!c.enabled}
                onChange={(e) => patch({ checks: draft.checks.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })}
              />
            </Box>
          ))}
        </Stack>

        {errors.length > 0 && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {errors.map((e) => (
              <div key={e}>{e[0].toUpperCase() + e.slice(1)}</div>
            ))}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button
          color="inherit"
          sx={{ mr: 'auto' }}
          onClick={() => {
            setDraft(lesson ? draftFromLesson(lesson) : emptyDraft());
            setErrors([]);
          }}
        >
          {lesson ? 'Отменить правки' : 'Очистить'}
        </Button>
        <Button onClick={onClose}>Закрыть</Button>
        <Button variant="contained" onClick={save}>
          Сохранить задание
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LessonEditorDialog;
