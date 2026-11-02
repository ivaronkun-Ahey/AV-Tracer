import React from 'react';
import { Tooltip } from '@mui/material';
import { useSaveStatus } from '../store/saveStatus';

const time = (at: number) => new Date(at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

/** Строка состояния: сохранена ли схема в браузере. */
const AutosaveIndicator: React.FC = () => {
  const status = useSaveStatus();
  if (status.state === 'idle') return null;
  if (status.state === 'pending') return <span>Сохранение…</span>;
  if (status.state === 'saved') {
    return (
      <Tooltip title="Схема сохраняется в этом браузере автоматически. Для переноса и резервной копии — «Сохранить» в файл.">
        <span>Сохранено в браузере · {time(status.at)}</span>
      </Tooltip>
    );
  }
  return (
    <span style={{ color: '#F44336' }}>
      Не удалось сохранить в браузере ({time(status.at)}) — сохраните проект в файл
    </span>
  );
};

export default AutosaveIndicator;
