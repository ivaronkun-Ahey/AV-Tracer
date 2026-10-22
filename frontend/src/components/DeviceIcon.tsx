import React from 'react';
import { deviceIconPath, ICON_VIEWBOX } from './deviceIcons';

/** Пиктограмма устройства — та же, что на холсте. */
const DeviceIcon: React.FC<{ type: string; color: string; size?: number }> = ({ type, color, size = 22 }) => (
  <svg width={size} height={size} viewBox={`0 0 ${ICON_VIEWBOX} ${ICON_VIEWBOX}`} aria-hidden focusable="false">
    <path d={deviceIconPath(type)} fill={color} />
  </svg>
);

export default DeviceIcon;
