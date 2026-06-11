import React from 'react';
import { Box, Typography, Button, Stack } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useAppDispatch } from '../store';
import { loadProject, showToast } from '../features/canvasSlice';
import { EXAMPLE_PROJECTS } from '../data/examples';

const EmptyState: React.FC = () => {
  const dispatch = useAppDispatch();

  const loadExample = () => {
    const example = EXAMPLE_PROJECTS[0];
    dispatch(loadProject(example.build()));
    dispatch(showToast({ message: `Загружен пример: ${example.name}`, severity: 'success' }));
  };

  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        pointerEvents: 'none',
        px: 3,
      }}
    >
      <Box sx={{ pointerEvents: 'auto', maxWidth: 460 }}>
        <Typography sx={{ fontSize: 56, mb: 1 }}>🎛️</Typography>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
          Холст пуст
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
          Перетащите устройство из <b>библиотеки слева</b>, чтобы начать собирать схему.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Соединяйте устройства: кликните по <b>нижнему</b> (выходному) кружку, затем по{' '}
          <b>верхнему</b> (входному) кружку другого устройства.
        </Typography>
        <Stack direction="row" spacing={2} justifyContent="center">
          <Button variant="contained" startIcon={<AutoAwesomeIcon />} onClick={loadExample}>
            Загрузить пример
          </Button>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            sx={{ pointerEvents: 'none', opacity: 0.7 }}
            disableRipple
          >
            или перетащите устройство
          </Button>
        </Stack>
      </Box>
    </Box>
  );
};

export default EmptyState;
