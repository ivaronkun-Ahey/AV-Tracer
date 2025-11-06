export type SignalType = 'analog_audio' | 'digital_audio' | 'video' | 'hdmi' | 'sdi' | 'network' | 'control';
export type CableType = 'xlr' | 'trs' | 'speakon' | 'hdmi' | 'sdi' | 'cat6' | 'rca' | 'bnc';
export type PortDirection = 'input' | 'output' | 'bidirectional';
export type DeviceCategory = 'audio' | 'video' | 'network' | 'control';

export interface Port {
  id: string;
  type: CableType;
  direction: PortDirection;
  signal_type: SignalType;
  label?: string;
}

export interface Device {
  id: string;
  type: string;
  category: DeviceCategory;
  manufacturer: string;
  model: string;
  full_name: string;
  position: { x: number; y: number };
  ports: Port[];
  properties: Record<string, any>;
  specs?: Record<string, any>;
  icon_url?: string;
}

export interface Connection {
  id: string;
  from: {
    device: string;
    port: string;
  };
  to: {
    device: string;
    port: string;
  };
  cable_type: CableType;
  cable_length: number;
}

export interface Project {
  id: string;
  name: string;
  devices: Device[];
  connections: Connection[];
  created_at: string;
  updated_at: string;
}
