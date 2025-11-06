from typing import List, Dict, Optional, Set


class SimulationEngine:
    """
    Core simulation engine for AVTrainer
    Simulates signal flow through AV equipment
    """
    
    def __init__(self):
        self.devices: Dict[str, Dict] = {}
        self.connections: List[Dict] = []
        
    def load_topology(self, devices: List, connections: List):
        """Load devices and connections into the engine"""
        # Convert to dict for easy lookup
        self.devices = {d.id if hasattr(d, 'id') else d['id']: d for d in devices}
        self.connections = connections
        
    def run_simulation(self) -> Dict:
        """Run full system simulation"""
        # Build signal graph
        graph = self._build_signal_graph()
        
        # Simulate audio chains
        audio_flows = self._simulate_audio_chains(graph)
        
        # Simulate video chains
        video_flows = self._simulate_video_chains(graph)
        
        # Check for issues
        warnings = self._check_warnings()
        errors = self._check_errors()
        
        return {
            "valid": len(errors) == 0,
            "signal_flows": audio_flows + video_flows,
            "warnings": warnings,
            "errors": errors,
        }
    
    def _build_signal_graph(self) -> Dict[str, List[Dict]]:
        """Build directed graph of signal flow"""
        graph = {}
        
        for conn in self.connections:
            # Handle both object and dict connections
            from_device = getattr(conn, 'from_device', None) or conn.get('from', {}).get('device')
            to_device = getattr(conn, 'to_device', None) or conn.get('to', {}).get('device')
            from_port = getattr(conn, 'from_port', None) or conn.get('from', {}).get('port')
            to_port = getattr(conn, 'to_port', None) or conn.get('to', {}).get('port')
            
            if not from_device:
                continue
                
            if from_device not in graph:
                graph[from_device] = []
            
            graph[from_device].append({
                'to': to_device,
                'from_port': from_port,
                'to_port': to_port,
                'cable_type': getattr(conn, 'cable_type', conn.get('cable_type')),
            })
        
        return graph
    
    def _simulate_audio_chains(self, graph: Dict) -> List[Dict]:
        """Simulate audio signal paths"""
        flows = []
        
        # Find audio sources (microphones)
        sources = [
            dev_id for dev_id, dev in self.devices.items()
            if self._get_device_type(dev) == 'microphone'
        ]
        
        for source_id in sources:
            signal_level = -60.0  # Mic level in dBu
            path = [source_id]
            
            # Trace signal path
            current = source_id
            visited: Set[str] = set()
            
            while current and current not in visited:
                visited.add(current)
                
                if current not in graph:
                    break
                
                # Get next device
                next_hops = graph[current]
                if not next_hops:
                    break
                
                next_hop = next_hops[0]  # Simplified: take first connection
                next_device_id = next_hop['to']
                
                if not next_device_id:
                    break
                
                # Process signal through device
                device = self.devices[next_device_id]
                signal_level = self._process_audio_signal(device, signal_level)
                
                path.append(next_device_id)
                current = next_device_id
            
            # Determine status
            status = 'ok' if -10 <= signal_level <= 10 else 'warning'
            
            flows.append({
                'type': 'audio',
                'source': source_id,
                'path': path,
                'final_level_db': signal_level,
                'status': status,
            })
        
        return flows
    
    def _process_audio_signal(self, device, input_level: float) -> float:
        """Process audio signal through a device"""
        output_level = input_level
        
        device_type = self._get_device_type(device)
        properties = self._get_device_properties(device)
        
        if device_type == 'mixer':
            gain = properties.get('gain', 0) or properties.get('master_gain', 0)
            output_level += gain
            
        elif device_type == 'amplifier':
            gain = properties.get('gain', 20)
            output_level += gain
            
        elif device_type == 'speaker':
            # Speaker doesn't change signal level (it converts to acoustic)
            pass
        
        return output_level
    
    def _simulate_video_chains(self, graph: Dict) -> List[Dict]:
        """Simulate video signal paths"""
        flows = []
        
        # Find video sources
        sources = [
            dev_id for dev_id, dev in self.devices.items()
            if self._get_device_type(dev) in ['camera']
        ]
        
        for source_id in sources:
            source_device = self.devices[source_id]
            properties = self._get_device_properties(source_device)
            resolution = properties.get('resolution', '1920x1080')
            
            path = self._trace_path(source_id, graph, 'video')
            
            flows.append({
                'type': 'video',
                'source': source_id,
                'path': path,
                'resolution': resolution,
                'status': 'ok',
            })
        
        return flows
    
    def _trace_path(self, start: str, graph: Dict, signal_type: str) -> List[str]:
        """Trace signal path of specific type"""
        path = [start]
        current = start
        visited: Set[str] = set()
        
        while current and current not in visited:
            visited.add(current)
            
            if current not in graph:
                break
            
            connections = graph[current]
            if not connections:
                break
            
            next_hop = connections[0]
            current = next_hop['to']
            if current:
                path.append(current)
        
        return path
    
    def _check_warnings(self) -> List[Dict]:
        """Check for configuration warnings"""
        warnings = []
        
        # Check phantom power for condenser mics
        for device_id, device in self.devices.items():
            if self._get_device_type(device) == 'microphone':
                properties = self._get_device_properties(device)
                specs = self._get_device_specs(device)
                
                if specs.get('requires_phantom', False):
                    # Check if phantom power is enabled
                    if not properties.get('phantom_power', False):
                        warnings.append({
                            'type': 'phantom_power',
                            'device': device_id,
                            'message': 'Condenser microphone requires phantom power',
                            'severity': 'medium',
                        })
        
        return warnings
    
    def _check_errors(self) -> List[Dict]:
        """Check for critical errors"""
        errors = []
        
        # Check for devices without input
        for device_id, device in self.devices.items():
            device_type = self._get_device_type(device)
            
            if device_type in ['speaker', 'display', 'projector']:
                if not self._has_input_connection(device_id):
                    errors.append({
                        'type': 'no_input',
                        'device': device_id,
                        'message': f'{device_type} has no input connection',
                    })
        
        return errors
    
    def _has_input_connection(self, device_id: str) -> bool:
        """Check if device has input connection"""
        for conn in self.connections:
            to_device = getattr(conn, 'to_device', None) or conn.get('to', {}).get('device')
            if to_device == device_id:
                return True
        return False
    
    def _get_device_type(self, device) -> str:
        """Get device type from device object or dict"""
        if hasattr(device, 'type'):
            return device.type
        return device.get('type', '')
    
    def _get_device_properties(self, device) -> Dict:
        """Get device properties"""
        if hasattr(device, 'properties'):
            return device.properties
        return device.get('properties', {})
    
    def _get_device_specs(self, device) -> Dict:
        """Get device specs"""
        if hasattr(device, 'specs'):
            return getattr(device, 'specs', {})
        return device.get('specs', {})
