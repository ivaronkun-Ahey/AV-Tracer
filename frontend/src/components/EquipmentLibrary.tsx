import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Card,
  CardContent,
  Chip,
  InputAdornment,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import { EQUIPMENT_LIBRARY } from '../data/equipment';
import { EquipmentTemplate } from '../types/device.types';
import { CATEGORY_LABELS, SUBCATEGORY_LABELS, deviceTypeLabel } from '../data/labels';
import DeviceIcon from './DeviceIcon';
import { categoryColor } from './deviceGeometry';

const EquipmentLibrary: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<string>('audio');

  const handleDragStart = (equipment: EquipmentTemplate) => (e: React.DragEvent) => {
    e.dataTransfer.setData('equipmentId', equipment._id);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const q = searchQuery.trim().toLowerCase();
  const filtered = EQUIPMENT_LIBRARY.map((category) => ({
    ...category,
    subcategories: category.subcategories
      .map((sub) => ({
        ...sub,
        items: sub.items.filter(
          (item) =>
            q === '' ||
            item.full_name.toLowerCase().includes(q) ||
            item.model.toLowerCase().includes(q) ||
            item.manufacturer.toLowerCase().includes(q) ||
            deviceTypeLabel(item.type).toLowerCase().includes(q)
        ),
      }))
      .filter((sub) => sub.items.length > 0),
  })).filter((category) => category.subcategories.length > 0);

  return (
    <Box sx={{ p: 2, height: '100%', overflow: 'auto' }}>
      <Typography variant="subtitle1" sx={{ mb: 0.5, fontWeight: 700 }}>
        Библиотека оборудования
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        Перетащите устройство на холст
      </Typography>

      <TextField
        fullWidth
        size="small"
        placeholder="Поиск: модель, производитель…"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
            </InputAdornment>
          ),
        }}
        sx={{ mb: 2 }}
      />

      {filtered.map((category) => {
        const count = category.subcategories.reduce((acc, s) => acc + s.items.length, 0);
        const isExpanded = q !== '' || expandedCategory === category.category;
        return (
          <Accordion
            key={category.category}
            expanded={isExpanded}
            onChange={(_, exp) => setExpandedCategory(exp ? category.category : '')}
            disableGutters
            sx={{ bgcolor: 'transparent', boxShadow: 'none', '&:before': { display: 'none' }, mb: 1 }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{
                bgcolor: 'rgba(255,255,255,0.04)',
                borderRadius: 1,
                minHeight: 44,
                '&:hover': { bgcolor: 'rgba(255,255,255,0.07)' },
              }}
            >
              <Typography
                component="div"
                sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', fontWeight: 600 }}
              >
                <span>{category.icon}</span>
                {CATEGORY_LABELS[category.category] || category.name}
                <Chip
                  label={count}
                  size="small"
                  sx={{ ml: 'auto', bgcolor: categoryColor(category.category), color: '#fff', fontWeight: 700, height: 20 }}
                />
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 1 }}>
              {category.subcategories.map((sub) => (
                <Box key={sub.name} sx={{ mb: 1.5 }}>
                  <Typography
                    variant="caption"
                    sx={{ fontWeight: 700, color: 'text.secondary', mb: 0.5, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5 }}
                  >
                    {SUBCATEGORY_LABELS[sub.name] || sub.name}
                  </Typography>
                  {sub.items.map((item) => (
                    <Card
                      key={item._id}
                      draggable
                      onDragStart={handleDragStart(item)}
                      sx={{
                        mb: 0.75,
                        cursor: 'grab',
                        bgcolor: 'rgba(255,255,255,0.04)',
                        borderLeft: `3px solid ${categoryColor(category.category)}`,
                        transition: 'all 0.15s',
                        '&:hover': {
                          bgcolor: 'rgba(255,255,255,0.09)',
                          transform: 'translateY(-2px)',
                          boxShadow: `0 4px 14px ${categoryColor(category.category)}40`,
                        },
                        '&:active': { cursor: 'grabbing' },
                      }}
                    >
                      <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 }, display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Box sx={{ display: 'flex', flexShrink: 0 }}>
                          <DeviceIcon type={item.type} color={categoryColor(item.category)} />
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }} noWrap>
                            {item.model}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                            {deviceTypeLabel(item.type)} · {item.manufacturer} · {item.ports.length} порт.
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              ))}
            </AccordionDetails>
          </Accordion>
        );
      })}

      {filtered.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
          Ничего не найдено
        </Typography>
      )}
    </Box>
  );
};

export default EquipmentLibrary;
