import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, IconButton, Tooltip, Alert, Stack, Chip, Collapse } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RemoveIcon from '@mui/icons-material/Remove';
import SchoolIcon from '@mui/icons-material/School';
import CheckIcon from '@mui/icons-material/Check';
import ClearIcon from '@mui/icons-material/Clear';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import { useStore } from 'react-redux';
import { RootState, useAppDispatch, useAppSelector } from '../store';
import { setResults, showHint } from '../features/lessonSlice';
import { findLesson, LESSONS } from '../learning/lessons';
import { checkLesson, exitLessonSession, showLessonSolution, startLessonSession } from '../learning/session';

/** Карточка текущего задания поверх холста: цель, теория, подсказки, проверка. */
const LessonPanel: React.FC<{ onOpenList: () => void }> = ({ onOpenList }) => {
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
  const lessonState = useAppSelector((s) => s.lesson);
  const devices = useAppSelector((s) => s.canvas.devices);
  const connections = useAppSelector((s) => s.canvas.connections);
  const [collapsed, setCollapsed] = useState(false);
  const [theoryOpen, setTheoryOpen] = useState(false);
  const lesson = findLesson(lessonState.activeId, lessonState.custom);

  // Схема изменилась — прежний результат проверки уже не про неё
  useEffect(() => {
    if (lessonState.results && !lessonState.solved) dispatch(setResults(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devices, connections]);

  useEffect(() => setTheoryOpen(false), [lessonState.activeId]);

  if (!lesson) return null;
  // Следующее — в том же списке: встроенные задания или свои
  const list = LESSONS.includes(lesson) ? LESSONS : lessonState.custom;
  const next = list[list.indexOf(lesson) + 1];

  if (collapsed) {
    return (
      <Box sx={{ position: 'absolute', top: 12, right: 12, zIndex: 6 }}>
        <Chip icon={<SchoolIcon />} label={`Задание: ${lesson.title}`} onClick={() => setCollapsed(false)} color="primary" />
      </Box>
    );
  }

  return (
    <Box
      role="region"
      aria-label="Учебное задание"
      sx={{
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 6,
        width: 'min(360px, calc(100% - 24px))',
        maxHeight: 'calc(100% - 90px)',
        overflow: 'auto',
        bgcolor: '#161b22',
        border: '1px solid #30363d',
        borderRadius: 2,
        boxShadow: 8,
        p: 2,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <SchoolIcon fontSize="small" color="primary" />
        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {lesson.kind === 'build' ? 'Соберите систему' : 'Найдите неисправность'}
        </Typography>
        <Tooltip title="Свернуть">
          <IconButton size="small" onClick={() => setCollapsed(true)} sx={{ ml: 'auto' }} aria-label="Свернуть задание">
            <RemoveIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Выйти из задания">
          <IconButton size="small" onClick={() => exitLessonSession(dispatch)} aria-label="Выйти из задания">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.25, mb: 0.5 }}>
        {lesson.title}
      </Typography>
      <Typography variant="body2" sx={{ mb: 1 }}>
        {lesson.goal}
      </Typography>
      <Button size="small" onClick={() => setTheoryOpen(!theoryOpen)} sx={{ px: 0, mb: 0.5 }}>
        {theoryOpen ? 'Скрыть теорию' : 'Теория'}
      </Button>
      <Collapse in={theoryOpen}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {lesson.theory}
        </Typography>
      </Collapse>

      {lessonState.hintsShown > 0 && (
        <Stack spacing={0.5} sx={{ mb: 1 }}>
          {lesson.hints.slice(0, lessonState.hintsShown).map((h, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 0.75, alignItems: 'flex-start' }}>
              <LightbulbIcon sx={{ fontSize: 16, color: '#FFC107', mt: '2px' }} />
              <Typography variant="body2">{h}</Typography>
            </Box>
          ))}
        </Stack>
      )}

      {lessonState.solved ? (
        <Alert severity="success" sx={{ my: 1 }}>
          Задание выполнено!
        </Alert>
      ) : (
        lessonState.results && (
          <Stack spacing={0.5} sx={{ my: 1 }} aria-label="Результат проверки">
            {lessonState.results.map((r, i) => (
              <Box key={i} sx={{ display: 'flex', gap: 0.75, alignItems: 'flex-start' }}>
                {r.ok ? (
                  <CheckIcon sx={{ fontSize: 18, color: '#3DDC84' }} titleAccess="выполнено" />
                ) : (
                  <ClearIcon sx={{ fontSize: 18, color: '#F44336' }} titleAccess="не выполнено" />
                )}
                <Box>
                  <Typography variant="body2">{r.text}</Typography>
                  {!r.ok && r.detail && (
                    <Typography variant="caption" color="text.secondary">
                      {r.detail}
                    </Typography>
                  )}
                </Box>
              </Box>
            ))}
          </Stack>
        )
      )}
      {lessonState.solutionShown && !lessonState.solved && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', my: 1 }}>
          Показано эталонное решение — разберите его и попробуйте собрать сами: начните задание заново из списка.
        </Typography>
      )}

      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
        {lessonState.solved && next ? (
          <Button variant="contained" size="small" onClick={() => startLessonSession(dispatch, store.getState(), next)}>
            Следующее задание
          </Button>
        ) : (
          <Button variant="contained" size="small" onClick={() => checkLesson(dispatch, store.getState(), lesson)}>
            Проверить
          </Button>
        )}
        <Button
          size="small"
          startIcon={<LightbulbIcon />}
          disabled={lessonState.hintsShown >= lesson.hints.length}
          onClick={() => dispatch(showHint(lesson.hints.length))}
        >
          Подсказка {lessonState.hintsShown}/{lesson.hints.length}
        </Button>
        {lessonState.hintsShown >= lesson.hints.length && !lessonState.solved && !lessonState.solutionShown && (
          <Button
            size="small"
            onClick={() => {
              if (confirm('Показать эталонное решение? Задание тогда не будет засчитано.')) showLessonSolution(dispatch, lesson);
            }}
          >
            Решение
          </Button>
        )}
        <Button size="small" onClick={onOpenList}>
          Все задания
        </Button>
      </Stack>
    </Box>
  );
};

export default LessonPanel;
