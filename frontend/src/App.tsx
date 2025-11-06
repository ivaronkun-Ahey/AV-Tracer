import React from 'react';
import { Box } from '@mui/material';
import MainLayout from './components/MainLayout';

const App: React.FC = () => {
  return (
    <Box sx={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <MainLayout />
    </Box>
  );
};

export default App;
