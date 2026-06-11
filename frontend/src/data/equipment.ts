// Comprehensive professional AV equipment library (30+ devices)
export const EQUIPMENT_LIBRARY = [
  {
    category: 'audio',
    name: 'Audio Equipment',
    icon: '🎤',
    subcategories: [
      {
        name: 'Microphones',
        items: [
          {
            _id: 'shure-sm58',
            type: 'microphone',
            manufacturer: 'Shure',
            model: 'SM58',
            full_name: 'Shure SM58 Dynamic Microphone',
            category: 'audio' as const,
            ports: [
              { id: 'xlr_out', type: 'xlr' as const, direction: 'output' as const, signal_type: 'analog_audio' as const }
            ],
            default_properties: { gain: 0, phantom_power: false, sensitivity: -54.5 },
            specs: { type: 'dynamic', pattern: 'cardioid', frequency_response: '50Hz-15kHz' },
          },
          {
            _id: 'shure-beta87a',
            type: 'microphone',
            manufacturer: 'Shure',
            model: 'Beta 87A',
            full_name: 'Shure Beta 87A Condenser',
            category: 'audio' as const,
            ports: [
              { id: 'xlr_out', type: 'xlr' as const, direction: 'output' as const, signal_type: 'analog_audio' as const }
            ],
            default_properties: { gain: 0, phantom_power: true, sensitivity: -52.0 },
            specs: { type: 'condenser', pattern: 'cardioid', requires_phantom: true },
          },
          {
            _id: 'akg-c414',
            type: 'microphone',
            manufacturer: 'AKG',
            model: 'C414 XLII',
            full_name: 'AKG C414 XLII Studio Condenser',
            category: 'audio' as const,
            ports: [
              { id: 'xlr_out', type: 'xlr' as const, direction: 'output' as const, signal_type: 'analog_audio' as const }
            ],
            default_properties: { gain: 0, phantom_power: true, pattern: 'cardioid', pad: 0 },
            specs: { type: 'condenser', patterns: ['omni', 'cardioid', 'figure-8'], requires_phantom: true },
          },
          {
            _id: 'sennheiser-e835',
            type: 'microphone',
            manufacturer: 'Sennheiser',
            model: 'e835',
            full_name: 'Sennheiser e835 Dynamic',
            category: 'audio' as const,
            ports: [
              { id: 'xlr_out', type: 'xlr' as const, direction: 'output' as const, signal_type: 'analog_audio' as const }
            ],
            default_properties: { gain: 0, phantom_power: false },
            specs: { type: 'dynamic', pattern: 'cardioid' },
          },
        ],
      },
      {
        name: 'Mixers & Consoles',
        items: [
          {
            _id: 'allen-heath-sq5',
            type: 'mixer',
            manufacturer: 'Allen & Heath',
            model: 'SQ-5',
            full_name: 'Allen & Heath SQ-5 Digital Mixer',
            category: 'audio' as const,
            ports: [
              { id: 'xlr_in_1', type: 'xlr' as const, direction: 'input' as const, signal_type: 'analog_audio' as const },
              { id: 'xlr_in_2', type: 'xlr' as const, direction: 'input' as const, signal_type: 'analog_audio' as const },
              { id: 'xlr_in_3', type: 'xlr' as const, direction: 'input' as const, signal_type: 'analog_audio' as const },
              { id: 'xlr_in_4', type: 'xlr' as const, direction: 'input' as const, signal_type: 'analog_audio' as const },
              { id: 'xlr_out_l', type: 'xlr' as const, direction: 'output' as const, signal_type: 'analog_audio' as const },
              { id: 'xlr_out_r', type: 'xlr' as const, direction: 'output' as const, signal_type: 'analog_audio' as const },
            ],
            default_properties: { channels: 16, master_gain: 0, phantom_power: true },
          },
          {
            _id: 'yamaha-mg12xu',
            type: 'mixer',
            manufacturer: 'Yamaha',
            model: 'MG12XU',
            full_name: 'Yamaha MG12XU Analog Mixer',
            category: 'audio' as const,
            ports: [
              { id: 'xlr_in_1', type: 'xlr' as const, direction: 'input' as const, signal_type: 'analog_audio' as const },
              { id: 'xlr_in_2', type: 'xlr' as const, direction: 'input' as const, signal_type: 'analog_audio' as const },
              { id: 'xlr_out_l', type: 'xlr' as const, direction: 'output' as const, signal_type: 'analog_audio' as const },
              { id: 'xlr_out_r', type: 'xlr' as const, direction: 'output' as const, signal_type: 'analog_audio' as const },
            ],
            default_properties: { channels: 12, master_gain: 0, effects: true },
          },
          {
            _id: 'behringer-x32',
            type: 'mixer',
            manufacturer: 'Behringer',
            model: 'X32',
            full_name: 'Behringer X32 Digital Mixer',
            category: 'audio' as const,
            ports: [
              { id: 'xlr_in_1', type: 'xlr' as const, direction: 'input' as const, signal_type: 'analog_audio' as const },
              { id: 'xlr_in_2', type: 'xlr' as const, direction: 'input' as const, signal_type: 'analog_audio' as const },
              { id: 'xlr_in_3', type: 'xlr' as const, direction: 'input' as const, signal_type: 'analog_audio' as const },
              { id: 'xlr_out_l', type: 'xlr' as const, direction: 'output' as const, signal_type: 'analog_audio' as const },
              { id: 'xlr_out_r', type: 'xlr' as const, direction: 'output' as const, signal_type: 'analog_audio' as const },
            ],
            default_properties: { channels: 32, master_gain: 0, phantom_power: true },
          },
        ],
      },
      {
        name: 'Amplifiers',
        items: [
          {
            _id: 'crown-xls2502',
            type: 'amplifier',
            manufacturer: 'Crown',
            model: 'XLS 2502',
            full_name: 'Crown XLS 2502 Power Amplifier',
            category: 'audio' as const,
            ports: [
              { id: 'xlr_in_l', type: 'xlr' as const, direction: 'input' as const, signal_type: 'analog_audio' as const },
              { id: 'xlr_in_r', type: 'xlr' as const, direction: 'input' as const, signal_type: 'analog_audio' as const },
              { id: 'speakon_out_l', type: 'speakon' as const, direction: 'output' as const, signal_type: 'analog_audio' as const },
              { id: 'speakon_out_r', type: 'speakon' as const, direction: 'output' as const, signal_type: 'analog_audio' as const },
            ],
            default_properties: { power_watts: 775, gain: 20, mode: 'stereo' },
          },
          {
            _id: 'qsc-gx5',
            type: 'amplifier',
            manufacturer: 'QSC',
            model: 'GX5',
            full_name: 'QSC GX5 Power Amplifier',
            category: 'audio' as const,
            ports: [
              { id: 'xlr_in_l', type: 'xlr' as const, direction: 'input' as const, signal_type: 'analog_audio' as const },
              { id: 'xlr_in_r', type: 'xlr' as const, direction: 'input' as const, signal_type: 'analog_audio' as const },
              { id: 'speakon_out_l', type: 'speakon' as const, direction: 'output' as const, signal_type: 'analog_audio' as const },
              { id: 'speakon_out_r', type: 'speakon' as const, direction: 'output' as const, signal_type: 'analog_audio' as const },
            ],
            default_properties: { power_watts: 500, gain: 20 },
          },
        ],
      },
      {
        name: 'Speakers',
        items: [
          {
            _id: 'jbl-prx815w',
            type: 'speaker',
            manufacturer: 'JBL',
            model: 'PRX815W',
            full_name: 'JBL PRX815W Powered Speaker',
            category: 'audio' as const,
            ports: [
              { id: 'xlr_in', type: 'xlr' as const, direction: 'input' as const, signal_type: 'analog_audio' as const },
              { id: 'xlr_thru', type: 'xlr' as const, direction: 'output' as const, signal_type: 'analog_audio' as const },
            ],
            default_properties: { power_watts: 1500, impedance_ohms: 8, active: true },
          },
          {
            _id: 'ev-zlx12p',
            type: 'speaker',
            manufacturer: 'Electro-Voice',
            model: 'ZLX-12P',
            full_name: 'EV ZLX-12P Powered Speaker',
            category: 'audio' as const,
            ports: [
              { id: 'xlr_in', type: 'xlr' as const, direction: 'input' as const, signal_type: 'analog_audio' as const },
            ],
            default_properties: { power_watts: 1000, impedance_ohms: 8, active: true },
          },
          {
            _id: 'qsc-k12',
            type: 'speaker',
            manufacturer: 'QSC',
            model: 'K12.2',
            full_name: 'QSC K12.2 Active Speaker',
            category: 'audio' as const,
            ports: [
              { id: 'xlr_in', type: 'xlr' as const, direction: 'input' as const, signal_type: 'analog_audio' as const },
              { id: 'xlr_thru', type: 'xlr' as const, direction: 'output' as const, signal_type: 'analog_audio' as const },
            ],
            default_properties: { power_watts: 2000, impedance_ohms: 8, active: true },
          },
          {
            _id: 'yorkville-yx15p',
            type: 'speaker',
            manufacturer: 'Yorkville',
            model: 'YX15P',
            full_name: 'Yorkville YX15P Passive Speaker',
            category: 'audio' as const,
            ports: [
              { id: 'speakon_in', type: 'speakon' as const, direction: 'input' as const, signal_type: 'analog_audio' as const },
            ],
            default_properties: { impedance_ohms: 8, active: false },
          },
        ],
      },
    ],
  },
  {
    category: 'video',
    name: 'Video Equipment',
    icon: '📹',
    subcategories: [
      {
        name: 'Cameras',
        items: [
          {
            _id: 'sony-srg300h',
            type: 'camera',
            manufacturer: 'Sony',
            model: 'SRG-300H',
            full_name: 'Sony SRG-300H PTZ Camera',
            category: 'video' as const,
            ports: [
              { id: 'hdmi_out', type: 'hdmi' as const, direction: 'output' as const, signal_type: 'hdmi' as const },
              { id: 'sdi_out', type: 'bnc' as const, direction: 'output' as const, signal_type: 'sdi' as const },
            ],
            default_properties: { resolution: '1920x1080', fps: 60, ptz: true, zoom: 30 },
          },
          {
            _id: 'panasonic-aw-ue150',
            type: 'camera',
            manufacturer: 'Panasonic',
            model: 'AW-UE150',
            full_name: 'Panasonic AW-UE150 4K PTZ Camera',
            category: 'video' as const,
            ports: [
              { id: 'hdmi_out', type: 'hdmi' as const, direction: 'output' as const, signal_type: 'hdmi' as const },
              { id: 'sdi_out', type: 'bnc' as const, direction: 'output' as const, signal_type: 'sdi' as const },
              { id: 'ip_out', type: 'cat6' as const, direction: 'output' as const, signal_type: 'network' as const },
            ],
            default_properties: { resolution: '3840x2160', fps: 60, ptz: true, zoom: 20 },
          },
          {
            _id: 'ptzoptics-20x',
            type: 'camera',
            manufacturer: 'PTZOptics',
            model: '20X-SDI',
            full_name: 'PTZOptics 20X-SDI Camera',
            category: 'video' as const,
            ports: [
              { id: 'hdmi_out', type: 'hdmi' as const, direction: 'output' as const, signal_type: 'hdmi' as const },
              { id: 'sdi_out', type: 'bnc' as const, direction: 'output' as const, signal_type: 'sdi' as const },
            ],
            default_properties: { resolution: '1920x1080', fps: 60, ptz: true, zoom: 20 },
          },
        ],
      },
      {
        name: 'Displays & Projectors',
        items: [
          {
            _id: 'samsung-qm85r',
            type: 'display',
            manufacturer: 'Samsung',
            model: 'QM85R',
            full_name: 'Samsung QM85R 85" 4K Display',
            category: 'video' as const,
            ports: [
              { id: 'hdmi_in_1', type: 'hdmi' as const, direction: 'input' as const, signal_type: 'hdmi' as const },
              { id: 'hdmi_in_2', type: 'hdmi' as const, direction: 'input' as const, signal_type: 'hdmi' as const },
              { id: 'hdmi_in_3', type: 'hdmi' as const, direction: 'input' as const, signal_type: 'hdmi' as const },
            ],
            default_properties: { size_inches: 85, resolution: '3840x2160', brightness_nits: 500 },
          },
          {
            _id: 'lg-75up8000',
            type: 'display',
            manufacturer: 'LG',
            model: '75UP8000',
            full_name: 'LG 75" 4K UHD Display',
            category: 'video' as const,
            ports: [
              { id: 'hdmi_in_1', type: 'hdmi' as const, direction: 'input' as const, signal_type: 'hdmi' as const },
              { id: 'hdmi_in_2', type: 'hdmi' as const, direction: 'input' as const, signal_type: 'hdmi' as const },
            ],
            default_properties: { size_inches: 75, resolution: '3840x2160', brightness_nits: 300 },
          },
          {
            _id: 'epson-l1755u',
            type: 'projector',
            manufacturer: 'Epson',
            model: 'EB-L1755U',
            full_name: 'Epson EB-L1755U Laser Projector',
            category: 'video' as const,
            ports: [
              { id: 'hdmi_in_1', type: 'hdmi' as const, direction: 'input' as const, signal_type: 'hdmi' as const },
              { id: 'hdmi_in_2', type: 'hdmi' as const, direction: 'input' as const, signal_type: 'hdmi' as const },
              { id: 'sdi_in', type: 'bnc' as const, direction: 'input' as const, signal_type: 'sdi' as const },
            ],
            default_properties: { lumens: 15000, resolution: '1920x1200', throw_ratio: 1.5 },
          },
          {
            _id: 'barco-f90',
            type: 'projector',
            manufacturer: 'Barco',
            model: 'F90-4K13',
            full_name: 'Barco F90-4K13 Laser Projector',
            category: 'video' as const,
            ports: [
              { id: 'hdmi_in_1', type: 'hdmi' as const, direction: 'input' as const, signal_type: 'hdmi' as const },
              { id: 'sdi_in', type: 'bnc' as const, direction: 'input' as const, signal_type: 'sdi' as const },
            ],
            default_properties: { lumens: 13000, resolution: '4096x2160', throw_ratio: 1.2 },
          },
        ],
      },
      {
        name: 'Switchers & Processors',
        items: [
          {
            _id: 'extron-in1608',
            type: 'switcher',
            manufacturer: 'Extron',
            model: 'IN1608',
            full_name: 'Extron IN1608 HDMI Switcher',
            category: 'video' as const,
            ports: [
              { id: 'hdmi_in_1', type: 'hdmi' as const, direction: 'input' as const, signal_type: 'hdmi' as const },
              { id: 'hdmi_in_2', type: 'hdmi' as const, direction: 'input' as const, signal_type: 'hdmi' as const },
              { id: 'hdmi_in_3', type: 'hdmi' as const, direction: 'input' as const, signal_type: 'hdmi' as const },
              { id: 'hdmi_in_4', type: 'hdmi' as const, direction: 'input' as const, signal_type: 'hdmi' as const },
              { id: 'hdmi_out_1', type: 'hdmi' as const, direction: 'output' as const, signal_type: 'hdmi' as const },
              { id: 'hdmi_out_2', type: 'hdmi' as const, direction: 'output' as const, signal_type: 'hdmi' as const },
            ],
            default_properties: { inputs: 16, outputs: 8, switching_type: 'seamless', resolution: '4K60' },
          },
          {
            _id: 'blackmagic-atem',
            type: 'switcher',
            manufacturer: 'Blackmagic Design',
            model: 'ATEM Mini Pro',
            full_name: 'Blackmagic ATEM Mini Pro',
            category: 'video' as const,
            ports: [
              { id: 'hdmi_in_1', type: 'hdmi' as const, direction: 'input' as const, signal_type: 'hdmi' as const },
              { id: 'hdmi_in_2', type: 'hdmi' as const, direction: 'input' as const, signal_type: 'hdmi' as const },
              { id: 'hdmi_in_3', type: 'hdmi' as const, direction: 'input' as const, signal_type: 'hdmi' as const },
              { id: 'hdmi_in_4', type: 'hdmi' as const, direction: 'input' as const, signal_type: 'hdmi' as const },
              { id: 'hdmi_out', type: 'hdmi' as const, direction: 'output' as const, signal_type: 'hdmi' as const },
            ],
            default_properties: { inputs: 4, outputs: 1, streaming: true },
          },
          {
            _id: 'roland-v60hd',
            type: 'switcher',
            manufacturer: 'Roland',
            model: 'V-60HD',
            full_name: 'Roland V-60HD Multi-Format Switcher',
            category: 'video' as const,
            ports: [
              { id: 'hdmi_in_1', type: 'hdmi' as const, direction: 'input' as const, signal_type: 'hdmi' as const },
              { id: 'hdmi_in_2', type: 'hdmi' as const, direction: 'input' as const, signal_type: 'hdmi' as const },
              { id: 'sdi_in_1', type: 'bnc' as const, direction: 'input' as const, signal_type: 'sdi' as const },
              { id: 'sdi_in_2', type: 'bnc' as const, direction: 'input' as const, signal_type: 'sdi' as const },
              { id: 'hdmi_out', type: 'hdmi' as const, direction: 'output' as const, signal_type: 'hdmi' as const },
              { id: 'sdi_out', type: 'bnc' as const, direction: 'output' as const, signal_type: 'sdi' as const },
            ],
            default_properties: { inputs: 6, outputs: 3 },
          },
          {
            _id: 'kramer-vp558',
            type: 'scaler',
            manufacturer: 'Kramer',
            model: 'VP-558',
            full_name: 'Kramer VP-558 Presentation Scaler',
            category: 'video' as const,
            ports: [
              { id: 'hdmi_in_1', type: 'hdmi' as const, direction: 'input' as const, signal_type: 'hdmi' as const },
              { id: 'hdmi_in_2', type: 'hdmi' as const, direction: 'input' as const, signal_type: 'hdmi' as const },
              { id: 'hdmi_out', type: 'hdmi' as const, direction: 'output' as const, signal_type: 'hdmi' as const },
            ],
            default_properties: { scaling: true, resolution_out: '1920x1080' },
          },
        ],
      },
    ],
  },
  {
    category: 'network',
    name: 'Network & Control',
    icon: '🌐',
    subcategories: [
      {
        name: 'Network Switches',
        items: [
          {
            _id: 'cisco-sg350',
            type: 'network_switch',
            manufacturer: 'Cisco',
            model: 'SG350-28',
            full_name: 'Cisco SG350-28 Managed Switch',
            category: 'network' as const,
            ports: [
              { id: 'eth_1', type: 'cat6' as const, direction: 'bidirectional' as const, signal_type: 'network' as const },
              { id: 'eth_2', type: 'cat6' as const, direction: 'bidirectional' as const, signal_type: 'network' as const },
              { id: 'eth_3', type: 'cat6' as const, direction: 'bidirectional' as const, signal_type: 'network' as const },
              { id: 'eth_4', type: 'cat6' as const, direction: 'bidirectional' as const, signal_type: 'network' as const },
            ],
            default_properties: { ports: 28, poe: true, managed: true, vlan: true },
          },
          {
            _id: 'netgear-gs728tp',
            type: 'network_switch',
            manufacturer: 'Netgear',
            model: 'GS728TP',
            full_name: 'Netgear GS728TP PoE Switch',
            category: 'network' as const,
            ports: [
              { id: 'eth_1', type: 'cat6' as const, direction: 'bidirectional' as const, signal_type: 'network' as const },
              { id: 'eth_2', type: 'cat6' as const, direction: 'bidirectional' as const, signal_type: 'network' as const },
              { id: 'eth_3', type: 'cat6' as const, direction: 'bidirectional' as const, signal_type: 'network' as const },
            ],
            default_properties: { ports: 24, poe: true, managed: true },
          },
        ],
      },
      {
        name: 'Audio Network',
        items: [
          {
            _id: 'shure-mxa910',
            type: 'array_microphone',
            manufacturer: 'Shure',
            model: 'MXA910',
            full_name: 'Shure MXA910 Ceiling Array Microphone',
            category: 'audio' as const,
            ports: [
              { id: 'dante_out', type: 'cat6' as const, direction: 'output' as const, signal_type: 'digital_audio' as const },
            ],
            default_properties: { channels: 8, dante: true, coverage_angle: 40 },
          },
          {
            _id: 'qsc-core-110f',
            type: 'dsp',
            manufacturer: 'QSC',
            model: 'Core 110f',
            full_name: 'QSC Core 110f Audio Processor',
            category: 'audio' as const,
            ports: [
              { id: 'dante_in', type: 'cat6' as const, direction: 'input' as const, signal_type: 'digital_audio' as const },
              { id: 'dante_out', type: 'cat6' as const, direction: 'output' as const, signal_type: 'digital_audio' as const },
              { id: 'xlr_out_1', type: 'xlr' as const, direction: 'output' as const, signal_type: 'analog_audio' as const },
              { id: 'xlr_out_2', type: 'xlr' as const, direction: 'output' as const, signal_type: 'analog_audio' as const },
            ],
            default_properties: { qsys: true, processing: 'dante', channels: 8 },
          },
        ],
      },
      {
        name: 'Control Systems',
        items: [
          {
            _id: 'crestron-cp3',
            type: 'controller',
            manufacturer: 'Crestron',
            model: 'CP3',
            full_name: 'Crestron CP3 Control Processor',
            category: 'control' as const,
            ports: [
              { id: 'eth', type: 'cat6' as const, direction: 'bidirectional' as const, signal_type: 'network' as const },
            ],
            default_properties: { control: true, programming: 'simpl' },
          },
          {
            _id: 'extron-ipcp-pro-550',
            type: 'controller',
            manufacturer: 'Extron',
            model: 'IPCP Pro 550',
            full_name: 'Extron IPCP Pro 550 Control Processor',
            category: 'control' as const,
            ports: [
              { id: 'eth', type: 'cat6' as const, direction: 'bidirectional' as const, signal_type: 'network' as const },
            ],
            default_properties: { control: true, programming: 'global_scripter' },
          },
        ],
      },
    ],
  },
];

export const getAllEquipment = () => {
  const allDevices: any[] = [];
  EQUIPMENT_LIBRARY.forEach(category => {
    category.subcategories.forEach(subcategory => {
      allDevices.push(...subcategory.items);
    });
  });
  return allDevices;
};
