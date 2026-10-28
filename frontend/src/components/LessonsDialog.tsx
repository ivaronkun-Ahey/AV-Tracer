import React from 'react';
import { Dialog, DialogTitle, DialogContent, List, ListItemButton, ListItemText, Typography, Box, Chip } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useStore } from 'react-redux';
import { RootState, useAppDispatch, useAppSelector } from '../store';
import { LESSONS } from '../learning/lessons';
import { startLessonSession } from '../learning/session';

const LEVEL = ['', 'начальный', 'средний', 'продвинутый'];
const GROUPS = [
  { kind: 'build', title: 'Соберите систему' },
  { kind: 'troubleshoot', title: 'Найдите неисправность' },
] as const;

/** Список учебных заданий: два раздела, уровень сложности и отметка о прохождении. */
const LessonsDialog: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
  const completed = useAppSelector((s) => s.lesson.completed);
  const activeId = useAppSelector((s) => s.lesson.activeId);

  const start = (id: string) => {
    const lesson = LESSONS.find((l) => l.id === id)!;
    const state = store.getState();
    if (!state.lesson.activeId && state.canvas.devices.length > 0) {
      if (!confirm('Начать задание? Ваша схема сохранится и вернётся, когда вы выйдете из учебного режима.')) return;
    }
    startLessonSession(dispatch, state, lesson);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Учебные задания
        <Typography variant="body2" color="text.secondary">
          Пройдено: {completed.filter((id) => LESSONS.some((l) => l.id === id)).length} из {LESSONS.length}
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        {GROUPS.map((g) => (
          <Box key={g.kind} sx={{ mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {g.title}
            </Typography>
            <List dense aria-label={g.title}>
              {LESSONS.filter((l) => l.kind === g.kind).map((l) => (
                <ListItemButton key={l.id} onClick={() => start(l.id)} selected={l.id === activeId} sx={{ borderRadius: 1 }}>
                  <ListItemText
                    primary={
                      <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {l.title}
                        {completed.includes(l.id) && <CheckCircleIcon fontSize="small" color="success" titleAccess="пройдено" />}
                        <Chip label={LEVEL[l.level]} size="small" variant="outlined" sx={{ ml: 'auto', height: 20 }} />
                      </Box>
                    }
                    secondary={l.goal}
                  />
                </ListItemButton>
              ))}
            </List>
          </Box>
        ))}
      </DialogContent>
    </Dialog>
  );
};

export default LessonsDialog;
