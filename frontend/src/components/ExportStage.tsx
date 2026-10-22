import React, { useEffect, useMemo, useRef } from 'react';
import { Stage, Layer, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import { Connection, Device } from '../types/device.types';
import DeviceNode from './DeviceNode';
import ConnectionLine from './ConnectionLine';
import { CanvasRenderContext, LIGHT_PALETTE } from './canvasTheme';
import { diagramBounds } from './deviceGeometry';
import { deviceTags } from '../data/deviceTags';

interface ExportStageProps {
  devices: Device[];
  connections: Connection[];
  showCableLabels: boolean;
  onRendered: (dataUrl: string) => void;
}

const PAD = 40;
const FOOTER = 28;

/**
 * Невидимый холст для экспорта: та же схема в светлой «печатной» теме, без
 * выделений и подсказок, обрезанная по габаритам схемы. Отрисовывается один раз
 * и возвращает PNG в onRendered.
 */
const ExportStage: React.FC<ExportStageProps> = ({ devices, connections, showCableLabels, onRendered }) => {
  const stageRef = useRef<Konva.Stage>(null);
  const bounds = diagramBounds(devices, connections) ?? { x: 0, y: 0, width: 400, height: 200 };
  // Запас снизу — для кабелей, которые обходят устройства
  const width = bounds.width + PAD * 2;
  const height = bounds.height + PAD * 2 + FOOTER + 40;
  const tags = useMemo(() => deviceTags(devices), [devices]);
  const context = useMemo(() => ({ palette: LIGHT_PALETTE, interactive: false, showCableLabels }), [showCableLabels]);
  const onRenderedRef = useRef(onRendered);
  onRenderedRef.current = onRendered;

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const stage = stageRef.current;
      if (stage) onRenderedRef.current(stage.toDataURL({ pixelRatio: 2, mimeType: 'image/png' }));
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const day = new Date().toLocaleDateString('ru-RU');

  return (
    <div style={{ position: 'fixed', left: -100000, top: 0, pointerEvents: 'none' }} aria-hidden>
      <Stage ref={stageRef} width={width} height={height}>
        <CanvasRenderContext.Provider value={context}>
          <Layer>
            <Rect width={width} height={height} fill={LIGHT_PALETTE.background} />
            <Rect
              x={8}
              y={8}
              width={width - 16}
              height={height - 16}
              stroke={LIGHT_PALETTE.nodeStroke}
              strokeWidth={1}
            />
          </Layer>
          {/* Схема сдвигается так, чтобы её левый верхний угол оказался у отступа */}
          <Layer x={PAD - bounds.x} y={PAD - bounds.y}>
            {connections.map((c) => (
              <ConnectionLine key={c.id} connection={c} devices={devices} />
            ))}
            {devices.map((d) => (
              <DeviceNode key={d.id} device={d} tag={tags[d.id]} />
            ))}
          </Layer>
          <Layer>
            <Text
              x={PAD}
              y={height - FOOTER - 6}
              width={width - PAD * 2}
              text={`Структурная схема · устройств: ${devices.length} · кабелей: ${connections.length} · ${day} · AV-Tracer`}
              fontSize={11}
              fill={LIGHT_PALETTE.subtitle}
              align="right"
            />
          </Layer>
        </CanvasRenderContext.Provider>
      </Stage>
    </div>
  );
};

export default ExportStage;
