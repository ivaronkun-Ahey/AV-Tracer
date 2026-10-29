import React, { useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  Box,
  Chip,
  Button,
  IconButton,
  Tooltip,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { useStore } from 'react-redux';
import { RootState, useAppDispatch, useAppSelector } from '../store';
import { showToast } from '../features/canvasSlice';
import { removeCustomLesson, saveCustomLessons } from '../features/lessonSlice';
import { dateStamp, downloadFile } from '../features/exportDocs';
import { LESSONS } from '../learning/lessons';
import { Lesson, lessonsFile, parseLessons } from '../learning/lessonSchema';
import { lessonId } from '../learning/authoring';
import { exitLessonSession, hasContent, startLessonSession } from '../learning/session';

const LEVEL = ['', 'начальный', 'средний', 'продвинутый'];
const GROUPS = [
  { kind: 'build', title: 'Соберите систему' },
  { kind: 'troubleshoot', title: 'Найдите неисправность' },
] as const;

/**
 * Список учебных заданий: встроенные (два раздела) и свои — созданные в
 * редакторе или загруженные из файла преподавателя.
 */
const LessonsDialog: React.FC<{ open: boolean; onClose: () => void; onEdit: (lesson?: Lesson) => void }> = ({ open, onClose, onEdit }) => {
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
  const completed = useAppSelector((s) => s.lesson.completed);
  const activeId = useAppSelector((s) => s.lesson.activeId);
  const custom = useAppSelector((s) => s.lesson.custom);
  const fileInput = useRef<HTMLInputElement>(null);

  const start = (lesson: Lesson) => {
    const state = store.getState();
    if (!state.lesson.activeId && hasContent(state.canvas)) {
      if (!confirm('Начать задание? Ваша схема сохранится и вернётся, когда вы выйдете из учебного режима.')) return;
    }
    if (startLessonSession(dispatch, state, lesson)) onClose();
  };

  const remove = (lesson: Lesson) => {
    if (!confirm(`Удалить задание «${lesson.title}»? Если оно не скачано в файл, вернуть его будет нельзя.`)) return;
    if (lesson.id === activeId) exitLessonSession(dispatch);
    dispatch(removeCustomLesson(lesson.id));
  };

  const exportFile = () => {
    const blob = new Blob([JSON.stringify(lessonsFile(custom), null, 2)], { type: 'application/json' });
    downloadFile(`av-tracer-zadaniya-${dateStamp()}.json`, blob);
  };

  const importFile = async (file: File) => {
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('файл больше 2 МБ');
      const lessons = parseLessons(JSON.parse(await file.text()));
      // Совпадение со встроенным заданием — новое id; со своим — замена (обновлённая версия)
      const builtIn = new Set(LESSONS.map((l) => l.id));
      const taken = new Set([...builtIn, ...custom.map((l) => l.id)]);
      const list = lessons.map((l) => {
        if (!builtIn.has(l.id)) return l;
        const id = lessonId(l.title, taken);
        taken.add(id);
        return { ...l, id };
      });
      const updated = list.filter((l) => custom.some((c) => c.id === l.id)).length;
      dispatch(saveCustomLessons(list));
      dispatch(
        showToast({
          message: `Загружено заданий: ${list.length}${updated ? ` (обновлено: ${updated})` : ''}`,
          severity: 'success',
        })
      );
    } catch (e) {
      const message = e instanceof SyntaxError ? 'это не файл JSON' : (e as Error).message;
      dispatch(showToast({ message: `Не удалось загрузить задания: ${message}`, severity: 'error' }));
    }
  };

  // Свои задания — наверху, если есть (ученик загрузил файл преподавателя), иначе — внизу
  const customSection = (
    <Box sx={{ mb: custom.length ? 2 : 0 }}>
      <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Свои задания
      </Typography>
      {custom.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ my: 1 }}>
          Создайте задание из схемы на холсте или загрузите файл заданий от преподавателя. Свои задания хранятся в этом браузере — чтобы
          передать их ученикам или не потерять, скачайте файл.
        </Typography>
      ) : (
        <List dense aria-label="Свои задания">
          {custom.map((l) => (
            <ListItem
              key={l.id}
              disablePadding
              // Место под две кнопки справа (стиль MUI для secondaryAction задаёт только 48 px)
              sx={{ '& > .MuiListItemButton-root': { pr: 13 } }}
              secondaryAction={
                <>
                  <Tooltip title="Изменить">
                    <IconButton edge="end" size="small" aria-label={`Изменить «${l.title}»`} onClick={() => onEdit(l)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Удалить">
                    <IconButton edge="end" size="small" aria-label={`Удалить «${l.title}»`} onClick={() => remove(l)} sx={{ ml: 0.5 }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </>
              }
            >
              <ListItemButton onClick={() => start(l)} selected={l.id === activeId} sx={{ borderRadius: 1 }}>
                <ListItemText
                  primary={
                    <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {l.title}
                      {completed.includes(l.id) && <CheckCircleIcon fontSize="small" color="success" titleAccess="пройдено" />}
                      <Chip
                        label={l.kind === 'build' ? 'сборка' : 'неисправность'}
                        size="small"
                        variant="outlined"
                        sx={{ ml: 'auto', height: 20 }}
                      />
                    </Box>
                  }
                  secondary={l.goal}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      )}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
        <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => onEdit()}>
          Создать задание
        </Button>
        <Button size="small" startIcon={<FileUploadIcon />} onClick={() => fileInput.current?.click()}>
          Загрузить файл
        </Button>
        <Button size="small" startIcon={<FileDownloadIcon />} onClick={exportFile} disabled={custom.length === 0}>
          Скачать свои задания
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          data-testid="lessons-file"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void importFile(file);
          }}
        />
      </Box>
    </Box>
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Учебные задания
        <Typography variant="body2" color="text.secondary">
          Пройдено: {completed.filter((id) => LESSONS.some((l) => l.id === id)).length} из {LESSONS.length}
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        {custom.length > 0 && customSection}
        {GROUPS.map((g) => (
          <Box key={g.kind} sx={{ mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {g.title}
            </Typography>
            <List dense aria-label={g.title}>
              {LESSONS.filter((l) => l.kind === g.kind).map((l) => (
                <ListItemButton key={l.id} onClick={() => start(l)} selected={l.id === activeId} sx={{ borderRadius: 1 }}>
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
        {custom.length === 0 && customSection}
      </DialogContent>
    </Dialog>
  );
};

export default LessonsDialog;
