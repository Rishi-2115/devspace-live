import { api } from './api';

export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  status: string;
  ports: Array<{
    privatePort: number;
    publicPort?: number;
    type: string;
  }>;
  created: string;
  state: string;
  stats?: ContainerStats;
}

export interface ContainerStats {
  cpu: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  network: {
    rx: number;
    tx: number;
  };
  disk: {
    read: number;
    write: number;
  };
}

export interface ImageInfo {
  id: string;
  repository: string;
  tag: string;
  size: number;
  created: string;
}

export interface VolumeInfo {
  name: string;
  driver: string;
  mountpoint: string;
  created: string;
  size?: number;
}

export interface NetworkInfo {
  id: string;
  name: string;
  driver: string;
  scope: string;
  created: string;
}

export class DockerApiService {
  // Container operations
  async listContainers(all: boolean = false): Promise<ContainerInfo[]> {
    const response = await api.get('/docker/containers', { params: { all } });
    return response.data;
  }

  async getContainer(containerId: string): Promise<ContainerInfo> {
    const response = await api.get(`/docker/containers/${containerId}`);
    return response.data;
  }

  async createContainer(config: {
    image: string;
    name?: string;
    ports?: { [key: string]: string };
    volumes?: { [key: string]: string };
    environment?: { [key: string]: string };
    command?: string[];
    workingDir?: string;
  }): Promise<{ id: string }> {
    const response = await api.post('/docker/containers', config);
    return response.data;
  }

  async startContainer(containerId: string): Promise<void> {
    await api.post(`/docker/containers/${containerId}/start`);
  }

  async stopContainer(containerId: string, timeout: number = 10): Promise<void> {
    await api.post(`/docker/containers/${containerId}/stop`, { timeout });
  }

  async restartContainer(containerId: string): Promise<void> {
    await api.post(`/docker/containers/${containerId}/restart`);
  }

  async removeContainer(containerId: string, force: boolean = false): Promise<void> {
    await api.delete(`/docker/containers/${containerId}`, { 
      params: { force } 
    });
  }

  async getContainerLogs(containerId: string, options?: {
    tail?: number;
    since?: string;
    until?: string;
    timestamps?: boolean;
  }): Promise<string> {
    const response = await api.get(`/docker/containers/${containerId}/logs`, {
      params: options
    });
    return response.data;
  }

  async getContainerStats(containerId: string): Promise<ContainerStats> {
    const response = await api.get(`/docker/containers/${containerId}/stats`);
    return response.data;
  }

  async execCommand(containerId: string, command: string[], options?: {
    workingDir?: string;
    user?: string;
    environment?: string[];
    tty?: boolean;
  }): Promise<{ exitCode: number; output: string }> {
    const response = await api.post(`/docker/containers/${containerId}/exec`, {
      command,
      ...options
    });
    return response.data;
  }

  // Image operations
  async listImages(): Promise<ImageInfo[]> {
    const response = await api.get('/docker/images');
    return response.data;
  }

  async pullImage(imageName: string, tag: string = 'latest'): Promise<void> {
    await api.post('/docker/images/pull', { image: `${imageName}:${tag}` });
  }

  async buildImage(dockerfile: string, context: string, tag: string): Promise<{ id: string }> {
    const response = await api.post('/docker/images/build', {
      dockerfile,
      context,
      tag
    });
    return response.data;
  }

  async removeImage(imageId: string, force: boolean = false): Promise<void> {
    await api.delete(`/docker/images/${imageId}`, { params: { force } });
  }

  // Volume operations
  async listVolumes(): Promise<VolumeInfo[]> {
    const response = await api.get('/docker/volumes');
    return response.data;
  }

  async createVolume(name: string, driver: string = 'local'): Promise<VolumeInfo> {
    const response = await api.post('/docker/volumes', { name, driver });
    return response.data;
  }

  async removeVolume(name: string, force: boolean = false): Promise<void> {
    await api.delete(`/docker/volumes/${name}`, { params: { force } });
  }

  // Network operations
  async listNetworks(): Promise<NetworkInfo[]> {
    const response = await api.get('/docker/networks');
    return response.data;
  }

  async createNetwork(name: string, driver: string = 'bridge'): Promise<NetworkInfo> {
    const response = await api.post('/docker/networks', { name, driver });
    return response.data;
  }

  async removeNetwork(id: string): Promise<void> {
    await api.delete(`/docker/networks/${id}`);
  }

  // System operations
  async getSystemInfo(): Promise<{
    containers: number;
    images: number;
    volumes: number;
    networks: number;
    version: string;
    memoryTotal: number;
    cpuCount: number;
  }> {
    const response = await api.get('/docker/system/info');
    return response.data;
  }

  async pruneSystem(): Promise<{
    containersDeleted: number;
    imagesDeleted: number;
    volumesDeleted: number;
    networksDeleted: number;
    spaceReclaimed: number;
  }> {
    const response = await api.post('/docker/system/prune');
    return response.data;
  }

  // File operations
  async copyToContainer(containerId: string, sourcePath: string, destPath: string): Promise<void> {
    await api.post(`/docker/containers/${containerId}/copy-to`, {
      sourcePath,
      destPath
    });
  }

  async copyFromContainer(containerId: string, sourcePath: string, destPath: string): Promise<void> {
    await api.post(`/docker/containers/${containerId}/copy-from`, {
      sourcePath,
      destPath
    });
  }

  // Monitoring
  async streamContainerStats(containerId: string, callback: (stats: ContainerStats) => void): Promise<() => void> {
    const eventSource = new EventSource(`${api.defaults.baseURL}/docker/containers/${containerId}/stats/stream`);
    
    eventSource.onmessage = (event) => {
      try {
        const stats = JSON.parse(event.data);
        callback(stats);
      } catch (error) {
        console.error('Error parsing container stats:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('Container stats stream error:', error);
    };

    return () => {
      eventSource.close();
    };
  }
}

export const dockerApi = new DockerApiService();

