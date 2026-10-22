import React from 'react';
import { Paper, IconButton, Typography, Divider, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import FitScreenIcon from '@mui/icons-material/FitScreen';

interface ZoomControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onFit: () => void;
}

const ZoomControls: React.FC<ZoomControlsProps> = ({ zoom, onZoomIn, onZoomOut, onReset, onFit }) => (
  <Paper
    elevation={4}
    sx={{
      position: 'absolute',
      bottom: 16,
      right: 16,
      display: 'flex',
      alignItems: 'center',
      bgcolor: '#1f2733',
      border: '1px solid #2d3645',
      borderRadius: 2,
      overflow: 'hidden',
    }}
  >
    <Tooltip title="Уменьшить">
      <IconButton size="small" onClick={onZoomOut}>
        <RemoveIcon fontSize="small" />
      </IconButton>
    </Tooltip>
    <Typography
      variant="body2"
      sx={{ minWidth: 48, textAlign: 'center', fontVariantNumeric: 'tabular-nums', userSelect: 'none' }}
    >
      {Math.round(zoom * 100)}%
    </Typography>
    <Tooltip title="Увеличить">
      <IconButton size="small" onClick={onZoomIn}>
        <AddIcon fontSize="small" />
      </IconButton>
    </Tooltip>
    <Divider orientation="vertical" flexItem sx={{ borderColor: '#2d3645' }} />
    <Tooltip title="Вписать схему в экран">
      <IconButton size="small" onClick={onFit}>
        <FitScreenIcon fontSize="small" />
      </IconButton>
    </Tooltip>
    <Tooltip title="Сбросить вид (100%)">
      <IconButton size="small" onClick={onReset}>
        <CenterFocusStrongIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  </Paper>
);

export default ZoomControls;
