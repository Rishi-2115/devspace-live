import React, { useState, useEffect } from 'react';
import { VirtualLabInstance } from '../types/virtualLab';
import { useWebSocket } from '../hooks/useWebSocket';
import '../styles/ResourceMonitor.css';

interface ResourceData {
  cpu: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
  };
  network: {
    rx: number;
    tx: number;
  };
  processes: Array<{
    pid: number;
    name: string;
    cpu: number;
    memory: number;
  }>;
  timestamp: number;
}

interface ResourceMonitorProps {
  labId: string;
  instance: VirtualLabInstance | null;
}

export const ResourceMonitor: React.FC<ResourceMonitorProps> = ({ labId, instance }) => {
  const [resourceData, setResourceData] = useState<ResourceData | null>(null);
  const [history, setHistory] = useState<ResourceData[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'processes' | 'network'>('overview');

  // Generate mock resource data
  const generateMockData = (): ResourceData => {
    const timestamp = Date.now();
    const cpuUsage = 15 + Math.random() * 30; // 15-45%
    const memoryUsed = 800 + Math.random() * 400; // 800-1200 MB
    const memoryTotal = 2048; // 2GB
    const diskUsed = 5000 + Math.random() * 1000; // 5-6 GB
    const diskTotal = 50000; // 50GB
    
    return {
      cpu: cpuUsage,
      memory: {
        used: memoryUsed * 1024 * 1024,
        total: memoryTotal * 1024 * 1024,
        percentage: (memoryUsed / memoryTotal) * 100
      },
      disk: {
        used: diskUsed * 1024 * 1024,
        total: diskTotal * 1024 * 1024,
        percentage: (diskUsed / diskTotal) * 100
      },
      network: {
        rx: Math.random() * 1024 * 100, // Random download speed up to 100 KB/s
        tx: Math.random() * 1024 * 50   // Random upload speed up to 50 KB/s
      },
      processes: [
        { pid: 1234, name: 'python', cpu: 25.5, memory: 150 * 1024 * 1024 },
        { pid: 5678, name: 'node', cpu: 12.3, memory: 89 * 1024 * 1024 },
        { pid: 9012, name: 'code-server', cpu: 8.7, memory: 245 * 1024 * 1024 },
        { pid: 3456, name: 'terminal', cpu: 5.2, memory: 45 * 1024 * 1024 },
        { pid: 7890, name: 'file-watcher', cpu: 3.1, memory: 32 * 1024 * 1024 },
        { pid: 1111, name: 'git', cpu: 1.8, memory: 28 * 1024 * 1024 },
        { pid: 2222, name: 'npm', cpu: 1.2, memory: 67 * 1024 * 1024 },
        { pid: 3333, name: 'docker', cpu: 0.9, memory: 123 * 1024 * 1024 },
        { pid: 4444, name: 'ssh', cpu: 0.5, memory: 12 * 1024 * 1024 },
        { pid: 5555, name: 'systemd', cpu: 0.3, memory: 18 * 1024 * 1024 }
      ].map(p => ({
        ...p,
        cpu: p.cpu + (Math.random() - 0.5) * 5, // Add some variation
        memory: p.memory + (Math.random() - 0.5) * p.memory * 0.2
      })),
      timestamp
    };
  };

  useEffect(() => {
    if (!instance || instance.status !== 'running') {
      setResourceData(null);
      setHistory([]);
      return;
    }

    // Generate initial data
    const initialData = generateMockData();
    setResourceData(initialData);
    setHistory([initialData]);

    // Update data every 2 seconds
    const interval = setInterval(() => {
      const newData = generateMockData();
      setResourceData(newData);
      setHistory(prev => {
        const newHistory = [...prev, newData];
        // Keep only last 30 data points
        return newHistory.slice(-30);
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [instance]);

  const handleResourceUpdate = (data: ResourceData) => {
    // This can be used for real websocket data if needed
    setResourceData(data);
    setHistory(prev => {
      const newHistory = [...prev, data];
      return newHistory.slice(-60);
    });
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatNetworkSpeed = (bytesPerSecond: number): string => {
    return formatBytes(bytesPerSecond) + '/s';
  };

  const getStatusColor = (percentage: number): string => {
    if (percentage < 50) return 'green';
    if (percentage < 80) return 'yellow';
    return 'red';
  };

  const renderProgressBar = (percentage: number, label: string, value?: string) => (
    <div className="progress-bar-container">
      <div className="progress-bar-header">
        <span className="progress-label">{label}</span>
        <span className="progress-value">{value || `${percentage.toFixed(1)}%`}</span>
      </div>
      <div className="progress-bar">
        <div 
          className={`progress-fill ${getStatusColor(percentage)}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );

  const renderChart = (data: number[], label: string, color: string) => {
    const maxValue = Math.max(...data, 100);
    const points = data.map((value, index) => {
      const x = (index / (data.length - 1)) * 100;
      const y = 100 - (value / maxValue) * 100;
      return `${x},${y}`;
    }).join(' ');

    return (
      <div className="chart-container">
        <div className="chart-header">
          <span className="chart-label">{label}</span>
          <span className="chart-current">{data[data.length - 1]?.toFixed(1)}%</span>
        </div>
        <svg className="chart" viewBox="0 0 100 50">
          <polyline
            points={points}
            fill="none"
            stroke={color}
            strokeWidth="2"
          />
        </svg>
      </div>
    );
  };

  if (!instance || instance.status !== 'running') {
    return (
      <div className="resource-monitor">
        <div className="resource-monitor-header">
          <h3>Resources</h3>
        </div>
        <div className="resource-monitor-body">
          <div className="no-data">
            <p>Lab not running</p>
            <span>Start the lab to monitor resources</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`resource-monitor ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="resource-monitor-header">
        <h3>Resources</h3>
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="toggle-button"
        >
          {isExpanded ? '−' : '+'}
        </button>
      </div>

      {isExpanded && (
        <div className="resource-monitor-body">
          <div className="resource-tabs">
            <button 
              className={selectedTab === 'overview' ? 'active' : ''}
              onClick={() => setSelectedTab('overview')}
            >
              Overview
            </button>
            <button 
              className={selectedTab === 'processes' ? 'active' : ''}
              onClick={() => setSelectedTab('processes')}
            >
              Processes
            </button>
            <button 
              className={selectedTab === 'network' ? 'active' : ''}
              onClick={() => setSelectedTab('network')}
            >
              Network
            </button>
          </div>

          <div className="resource-content">
            {selectedTab === 'overview' && resourceData && (
              <div className="overview-tab">
                <div className="resource-section">
                  <h4>CPU Usage</h4>
                  {renderProgressBar(
                    resourceData.cpu,
                    'CPU',
                    `${resourceData.cpu.toFixed(1)}%`
                  )}
                  {history.length > 1 && renderChart(
                    history.map(h => h.cpu),
                    'CPU History',
                    '#3498db'
                  )}
                </div>

                <div className="resource-section">
                  <h4>Memory Usage</h4>
                  {renderProgressBar(
                    resourceData.memory.percentage,
                    'Memory',
                    `${formatBytes(resourceData.memory.used)} / ${formatBytes(resourceData.memory.total)}`
                  )}
                  {history.length > 1 && renderChart(
                    history.map(h => h.memory.percentage),
                    'Memory History',
                    '#e74c3c'
                  )}
                </div>

                <div className="resource-section">
                  <h4>Disk Usage</h4>
                  {renderProgressBar(
                    resourceData.disk.percentage,
                    'Disk',
                    `${formatBytes(resourceData.disk.used)} / ${formatBytes(resourceData.disk.total)}`
                  )}
                </div>

                <div className="resource-section">
                  <h4>Network Activity</h4>
                  <div className="network-stats">
                    <div className="network-stat">
                      <span className="network-label">↓ Download</span>
                      <span className="network-value">{formatNetworkSpeed(resourceData.network.rx)}</span>
                    </div>
                    <div className="network-stat">
                      <span className="network-label">↑ Upload</span>
                      <span className="network-value">{formatNetworkSpeed(resourceData.network.tx)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedTab === 'processes' && resourceData && (
              <div className="processes-tab">
                <div className="processes-header">
                  <span>Process</span>
                  <span>PID</span>
                  <span>CPU%</span>
                  <span>Memory</span>
                </div>
                <div className="processes-list">
                  {resourceData.processes
                    .sort((a, b) => b.cpu - a.cpu)
                    .slice(0, 10)
                    .map(process => (
                      <div key={process.pid} className="process-item">
                        <span className="process-name" title={process.name}>
                          {process.name.length > 15 
                            ? process.name.substring(0, 15) + '...' 
                            : process.name
                          }
                        </span>
                        <span className="process-pid">{process.pid}</span>
                        <span className="process-cpu">{process.cpu.toFixed(1)}%</span>
                        <span className="process-memory">{formatBytes(process.memory)}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {selectedTab === 'network' && (
              <div className="network-tab">
                {history.length > 1 && (
                  <>
                    {renderChart(
                      history.map(h => h.network.rx / 1024), // Convert to KB/s
                      'Download Speed (KB/s)',
                      '#2ecc71'
                    )}
                    {renderChart(
                      history.map(h => h.network.tx / 1024), // Convert to KB/s
                      'Upload Speed (KB/s)',
                      '#f39c12'
                    )}
                  </>
                )}
                
                {resourceData && (
                  <div className="network-summary">
                    <div className="network-summary-item">
                      <span>Current Download</span>
                      <span>{formatNetworkSpeed(resourceData.network.rx)}</span>
                    </div>
                    <div className="network-summary-item">
                      <span>Current Upload</span>
                      <span>{formatNetworkSpeed(resourceData.network.tx)}</span>
                    </div>
                    <div className="network-summary-item">
                      <span>Total Download</span>
                      <span>{formatBytes(history.reduce((sum, h) => sum + h.network.rx, 0))}</span>
                    </div>
                    <div className="network-summary-item">
                      <span>Total Upload</span>
                      <span>{formatBytes(history.reduce((sum, h) => sum + h.network.tx, 0))}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="resource-footer">
            <div className="resource-status">
              <span className={`status-dot ${instance.status}`}></span>
              <span>Lab Status: {instance.status}</span>
            </div>
            <div className="last-updated">
              {resourceData && (
                <span>Updated: {new Date(resourceData.timestamp).toLocaleTimeString()}</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
