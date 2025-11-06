import React from 'react';
import { Box, Typography, TextField, FormControlLabel, Switch, Divider } from '@mui/material';
import { useAppSelector, useAppDispatch } from '../store';
import { updateDeviceProperty } from '../features/canvasSlice';

const PropertiesPanel: React.FC = () => {
  const dispatch = useAppDispatch();
  const selectedDeviceId = useAppSelector(state => state.canvas.selectedDeviceId);
  const devices = useAppSelector(state => state.canvas.devices);
  
  const selectedDevice = devices.find(d => d.id === selectedDeviceId);

  const handlePropertyChange = (property: string, value: any) => {
    if (selectedDevice) {
      dispatch(updateDeviceProperty({
        id: selectedDevice.id,
        property,
        value,
      }));
    }
  };

  if (!selectedDevice) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Select a device to view properties
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, height: '100%', overflow: 'auto' }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        Properties
      </Typography>

      {/* Device Info */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Device
        </Typography>
        <Typography variant="h6" sx={{ fontSize: '1.1rem', mb: 0.5 }}>
          {selectedDevice.model}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {selectedDevice.manufacturer}
        </Typography>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Position */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Position
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            label="X"
            size="small"
            type="number"
            value={Math.round(selectedDevice.position.x)}
            disabled
            fullWidth
          />
          <TextField
            label="Y"
            size="small"
            type="number"
            value={Math.round(selectedDevice.position.y)}
            disabled
            fullWidth
          />
        </Box>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Device-specific properties */}
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        Parameters
      </Typography>

      {renderDeviceProperties(selectedDevice, handlePropertyChange)}

      {/* Ports info */}
      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        Ports
      </Typography>
      {selectedDevice.ports.map((port, idx) => (
        <Box key={idx} sx={{ mb: 1, p: 1, bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {port.id}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {port.direction} • {port.signal_type}
          </Typography>
        </Box>
      ))}
    </Box>
  );
};

// Render device-specific properties
function renderDeviceProperties(device: any, onChange: (prop: string, value: any) => void) {
  const props = device.properties;

  // Common properties based on device type
  switch (device.type) {
    case 'microphone':
      return (
        <>
          <TextField
            label="Gain (dB)"
            type="number"
            size="small"
            fullWidth
            value={props.gain || 0}
            onChange={(e) => onChange('gain', Number(e.target.value))}
            sx={{ mb: 2 }}
          />
          {props.hasOwnProperty('phantom_power') && (
            <FormControlLabel
              control={
                <Switch
                  checked={props.phantom_power || false}
                  onChange={(e) => onChange('phantom_power', e.target.checked)}
                />
              }
              label="Phantom Power"
            />
          )}
        </>
      );

    case 'mixer':
      return (
        <>
          <TextField
            label="Channels"
            type="number"
            size="small"
            fullWidth
            value={props.channels || 16}
            disabled
            sx={{ mb: 2 }}
          />
          <TextField
            label="Master Gain (dB)"
            type="number"
            size="small"
            fullWidth
            value={props.gain || 0}
            onChange={(e) => onChange('gain', Number(e.target.value))}
            sx={{ mb: 2 }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={props.phantom_power || false}
                onChange={(e) => onChange('phantom_power', e.target.checked)}
              />
            }
            label="Phantom Power"
          />
        </>
      );

    case 'amplifier':
      return (
        <>
          <TextField
            label="Power (W)"
            type="number"
            size="small"
            fullWidth
            value={props.power || 0}
            disabled
            sx={{ mb: 2 }}
          />
          <TextField
            label="Gain (dB)"
            type="number"
            size="small"
            fullWidth
            value={props.gain || 0}
            onChange={(e) => onChange('gain', Number(e.target.value))}
            sx={{ mb: 2 }}
          />
        </>
      );

    case 'speaker':
      return (
        <>
          <TextField
            label="Power (W)"
            type="number"
            size="small"
            fullWidth
            value={props.power || 0}
            disabled
            sx={{ mb: 2 }}
          />
          <TextField
            label="Impedance (Ω)"
            type="number"
            size="small"
            fullWidth
            value={props.impedance || 8}
            disabled
            sx={{ mb: 2 }}
          />
        </>
      );

    case 'camera':
      return (
        <>
          <TextField
            label="Resolution"
            size="small"
            fullWidth
            value={props.resolution || '1920x1080'}
            onChange={(e) => onChange('resolution', e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            label="Frame Rate (fps)"
            type="number"
            size="small"
            fullWidth
            value={props.fps || 60}
            onChange={(e) => onChange('fps', Number(e.target.value))}
            sx={{ mb: 2 }}
          />
        </>
      );

    case 'display':
    case 'projector':
      return (
        <>
          <TextField
            label="Size (inches)"
            type="number"
            size="small"
            fullWidth
            value={props.size || 85}
            disabled
            sx={{ mb: 2 }}
          />
          <TextField
            label="Resolution"
            size="small"
            fullWidth
            value={props.resolution || '3840x2160'}
            disabled
            sx={{ mb: 2 }}
          />
        </>
      );

    default:
      return (
        <Typography variant="body2" color="text.secondary">
          No configurable parameters
        </Typography>
      );
  }
}

export default PropertiesPanel;
