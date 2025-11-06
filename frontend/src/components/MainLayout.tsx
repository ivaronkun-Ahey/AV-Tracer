import React, { useState } from 'react';
import { Box, AppBar, Toolbar, Typography, Button, ButtonGroup, Drawer } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SaveIcon from '@mui/icons-material/Save';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import DeleteIcon from '@mui/icons-material/Delete';
import EquipmentLibrary from './EquipmentLibrary';
import CanvasWorkspace from './CanvasWorkspace';
import PropertiesPanel from './PropertiesPanel';
import { useAppDispatch, useAppSelector } from '../store';
import { clearCanvas } from '../features/canvasSlice';

const MainLayout: React.FC = () => {
  const dispatch = useAppDispatch();
  const devices = useAppSelector(state => state.canvas.devices);
  const connections = useAppSelector(state => state.canvas.connections);
  const [simulationRunning, setSimulationRunning] = useState(false);

  const handleClear = () => {
    if (confirm('Clear all devices and connections?')) {
      dispatch(clearCanvas());
    }
  };

  const handleSave = () => {
    const project = {
      devices,
      connections,
      timestamp: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `av-project-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRunSimulation = async () => {
    setSimulationRunning(true);
    try {
      const response = await fetch('http://localhost:8000/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ devices, connections }),
      });
      const result = await response.json();
      alert(`Simulation ${result.valid ? 'Successful' : 'Failed'}!\n${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      console.error('Simulation failed:', error);
      alert('Simulation failed - make sure backend is running');
    } finally {
      setSimulationRunning(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header */}
      <AppBar position="static" sx={{ bgcolor: '#0d1117', borderBottom: '1px solid #30363d' }}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
            ⚡ AV-Tracer <span style={{ fontSize: '0.7em', opacity: 0.7 }}>Pro</span>
          </Typography>

          <ButtonGroup variant="contained" size="small">
            <Button startIcon={<FolderOpenIcon />}>Open</Button>
            <Button startIcon={<SaveIcon />} onClick={handleSave}>Save</Button>
            <Button
              startIcon={<PlayArrowIcon />}
              onClick={handleRunSimulation}
              disabled={simulationRunning}
              color="success"
            >
              {simulationRunning ? 'Running...' : 'Simulate'}
            </Button>
            <Button startIcon={<DeleteIcon />} onClick={handleClear} color="error">
              Clear
            </Button>
          </ButtonGroup>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Equipment Library - Left Panel */}
        <Drawer
          variant="permanent"
          sx={{
            width: 280,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: 280,
              boxSizing: 'border-box',
              position: 'relative',
              bgcolor: '#161b22',
              borderRight: '1px solid #30363d',
            },
          }}
        >
          <EquipmentLibrary />
        </Drawer>

        {/* Canvas - Center */}
        <Box sx={{ flex: 1, overflow: 'hidden', bgcolor: '#0d1117' }}>
          <CanvasWorkspace />
        </Box>

        {/* Properties Panel - Right */}
        <Drawer
          variant="permanent"
          anchor="right"
          sx={{
            width: 320,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: 320,
              boxSizing: 'border-box',
              position: 'relative',
              bgcolor: '#161b22',
              borderLeft: '1px solid #30363d',
            },
          }}
        >
          <PropertiesPanel />
        </Drawer>
      </Box>

      {/* Status Bar */}
      <Box
        sx={{
          px: 2,
          py: 1,
          bgcolor: '#0d1117',
          borderTop: '1px solid #30363d',
          display: 'flex',
          gap: 3,
          fontSize: '0.875rem',
        }}
      >
        <span>Devices: {devices.length}</span>
        <span>Connections: {connections.length}</span>
        <span>Status: Ready</span>
      </Box>
    </Box>
  );
};

export default MainLayout;
