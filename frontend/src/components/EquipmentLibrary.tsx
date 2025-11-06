import React, { useState } from 'react';
import { Box, Typography, TextField, Accordion, AccordionSummary, AccordionDetails, Card, CardContent, Chip } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import { EQUIPMENT_LIBRARY } from '../data/equipment';

const OLD_MOCK = [
  {
    category: 'audio',
    name: 'Аудио',
    icon: '🎤',
    items: [
      {
        _id: '1',
        type: 'microphone',
        manufacturer: 'Shure',
        model: 'SM58',
        full_name: 'Shure SM58 Dynamic Microphone',
        category: 'audio',
        ports: [
          { id: 'xlr_out', type: 'xlr', direction: 'output', signal_type: 'analog_audio' }
        ],
        default_properties: { gain: 0, phantom_power: false },
        icon_url: '',
      },
      {
        _id: '2',
        type: 'microphone',
        manufacturer: 'Shure',
        model: 'Beta 87A',
        full_name: 'Shure Beta 87A Condenser',
        category: 'audio',
        ports: [
          { id: 'xlr_out', type: 'xlr', direction: 'output', signal_type: 'analog_audio' }
        ],
        default_properties: { gain: 0, phantom_power: true },
        icon_url: '',
      },
      {
        _id: '3',
        type: 'mixer',
        manufacturer: 'Allen & Heath',
        model: 'SQ-5',
        full_name: 'Allen & Heath SQ-5 Digital Mixer',
        category: 'audio',
        ports: [
          { id: 'xlr_in_1', type: 'xlr', direction: 'input', signal_type: 'analog_audio' },
          { id: 'xlr_in_2', type: 'xlr', direction: 'input', signal_type: 'analog_audio' },
          { id: 'xlr_out_l', type: 'xlr', direction: 'output', signal_type: 'analog_audio' },
          { id: 'xlr_out_r', type: 'xlr', direction: 'output', signal_type: 'analog_audio' },
        ],
        default_properties: { channels: 16, gain: 0, phantom_power: true },
        icon_url: '',
      },
      {
        _id: '4',
        type: 'amplifier',
        manufacturer: 'Crown',
        model: 'XLS 2502',
        full_name: 'Crown XLS 2502 Power Amplifier',
        category: 'audio',
        ports: [
          { id: 'xlr_in_l', type: 'xlr', direction: 'input', signal_type: 'analog_audio' },
          { id: 'xlr_in_r', type: 'xlr', direction: 'input', signal_type: 'analog_audio' },
          { id: 'speakon_out_l', type: 'speakon', direction: 'output', signal_type: 'analog_audio' },
          { id: 'speakon_out_r', type: 'speakon', direction: 'output', signal_type: 'analog_audio' },
        ],
        default_properties: { power: 500, gain: 20 },
        icon_url: '',
      },
      {
        _id: '5',
        type: 'speaker',
        manufacturer: 'JBL',
        model: 'PRX815W',
        full_name: 'JBL PRX815W Powered Speaker',
        category: 'audio',
        ports: [
          { id: 'xlr_in', type: 'xlr', direction: 'input', signal_type: 'analog_audio' },
        ],
        default_properties: { power: 1500, impedance: 8 },
        icon_url: '',
      },
    ]
  },
  {
    category: 'video',
    name: 'Видео',
    icon: '📹',
    items: [
      {
        _id: '6',
        type: 'camera',
        manufacturer: 'Sony',
        model: 'SRG-300H',
        full_name: 'Sony SRG-300H PTZ Camera',
        category: 'video',
        ports: [
          { id: 'hdmi_out', type: 'hdmi', direction: 'output', signal_type: 'video' },
          { id: 'sdi_out', type: 'bnc', direction: 'output', signal_type: 'video' },
        ],
        default_properties: { resolution: '1920x1080', fps: 60, ptz: true },
        icon_url: '',
      },
      {
        _id: '7',
        type: 'display',
        manufacturer: 'Samsung',
        model: 'QM85R',
        full_name: 'Samsung QM85R 85" Display',
        category: 'video',
        ports: [
          { id: 'hdmi_in_1', type: 'hdmi', direction: 'input', signal_type: 'video' },
          { id: 'hdmi_in_2', type: 'hdmi', direction: 'input', signal_type: 'video' },
        ],
        default_properties: { size: 85, resolution: '3840x2160' },
        icon_url: '',
      },
      {
        _id: '8',
        type: 'projector',
        manufacturer: 'Epson',
        model: 'EB-L1755U',
        full_name: 'Epson EB-L1755U Projector',
        category: 'video',
        ports: [
          { id: 'hdmi_in_1', type: 'hdmi', direction: 'input', signal_type: 'video' },
          { id: 'hdmi_in_2', type: 'hdmi', direction: 'input', signal_type: 'video' },
        ],
        default_properties: { lumens: 15000, resolution: '1920x1200' },
        icon_url: '',
      },
      {
        _id: '9',
        type: 'switcher',
        manufacturer: 'Extron',
        model: 'IN1608',
        full_name: 'Extron IN1608 Video Switcher',
        category: 'video',
        ports: [
          { id: 'hdmi_in_1', type: 'hdmi', direction: 'input', signal_type: 'video' },
          { id: 'hdmi_in_2', type: 'hdmi', direction: 'input', signal_type: 'video' },
          { id: 'hdmi_out_1', type: 'hdmi', direction: 'output', signal_type: 'video' },
        ],
        default_properties: { inputs: 16, outputs: 8, switching: 'seamless' },
        icon_url: '',
      },
    ]
  }
];

const EquipmentLibrary: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<string>('audio');

  const handleCategoryChange = (category: string) => (_: any, isExpanded: boolean) => {
    setExpandedCategory(isExpanded ? category : '');
  };

  const handleDragStart = (equipment: any) => (e: React.DragEvent) => {
    e.dataTransfer.setData('deviceData', JSON.stringify(equipment));
  };

  const filteredEquipment = EQUIPMENT_LIBRARY.map(category => ({
    ...category,
    subcategories: category.subcategories.map(subcategory => ({
      ...subcategory,
      items: subcategory.items.filter(item =>
        searchQuery === '' ||
        item.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.manufacturer.toLowerCase().includes(searchQuery.toLowerCase())
      )
    })).filter(subcategory => subcategory.items.length > 0)
  })).filter(category => category.subcategories.length > 0);

  const getCategoryColor = (category: string) => {
    switch(category) {
      case 'audio': return '#FF6B00';
      case 'video': return '#00B8D4';
      case 'network': return '#00C853';
      default: return '#0066CC';
    }
  };

  return (
    <Box sx={{ p: 2, height: '100%', overflow: 'auto' }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        Equipment Library
      </Typography>

      {/* Search */}
      <TextField
        fullWidth
        size="small"
        placeholder="Search devices..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        InputProps={{
          startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
        }}
        sx={{ mb: 2 }}
      />

      {/* Categories */}
      {filteredEquipment.map((category) => (
        <Accordion
          key={category.category}
          expanded={expandedCategory === category.category}
          onChange={handleCategoryChange(category.category)}
          sx={{
            bgcolor: 'transparent',
            boxShadow: 'none',
            '&:before': { display: 'none' },
            mb: 1,
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              bgcolor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: 1,
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.08)',
              },
            }}
          >
            <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
              <span>{category.icon}</span>
              {category.name}
              <Chip
                label={category.subcategories.reduce((acc, sub) => acc + sub.items.length, 0)}
                size="small"
                sx={{ ml: 'auto', bgcolor: getCategoryColor(category.category), fontWeight: 700, fontSize: '0.7rem' }}
              />
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 1 }}>
            {category.subcategories.map((subcategory) => (
              <Box key={subcategory.name} sx={{ mb: 2 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, opacity: 0.7, mb: 1, display: 'block' }}>
                  {subcategory.name}
                </Typography>
                {subcategory.items.map((item) => (
                  <Card
                    key={item._id}
                    draggable
                    onDragStart={handleDragStart(item)}
                    sx={{
                      mb: 1,
                      cursor: 'grab',
                      bgcolor: 'rgba(255, 255, 255, 0.05)',
                      '&:hover': {
                        bgcolor: 'rgba(255, 255, 255, 0.1)',
                        transform: 'translateY(-2px)',
                        boxShadow: `0 4px 12px ${getCategoryColor(category.category)}40`,
                      },
                      '&:active': {
                        cursor: 'grabbing',
                      },
                      transition: 'all 0.2s',
                      borderLeft: `3px solid ${getCategoryColor(category.category)}`,
                    }}
                  >
                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                        {item.model}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {item.manufacturer}
                      </Typography>
                      <Typography variant="caption" sx={{ opacity: 0.6, fontSize: '0.7rem' }}>
                        {item.ports.length} port{item.ports.length !== 1 ? 's' : ''}
                      </Typography>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            ))}
          </AccordionDetails>
        </Accordion>
      ))}

      {filteredEquipment.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
          No devices found
        </Typography>
      )}
    </Box>
  );
};

export default EquipmentLibrary;
