import { useState, useEffect, useCallback } from 'react';
import { VirtualLabInstance, LabConfig } from '../types/virtualLab';

export const useVirtualLab = (labId: string, userId: string) => {
  const [labInstance, setLabInstance] = useState<VirtualLabInstance | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createLab = useCallback(async (config: LabConfig) => {
    setIsLoading(true);
    setError(null);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
      // Create mock lab instance
      const mockInstance: VirtualLabInstance = {
        id: labId,
        name: config.name,
        description: config.description,
        status: 'running',
        containerId: 'mock-container-123',
        imageId: config.image,
        ports: [],
        volumes: [],
        environment: {},
        resources: {
          memory: '1g',
          cpu: '1.0',
          disk: '10g'
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
        ownerId: userId,
        collaborators: [],
        settings: {
          autoSave: true,
          autoSaveInterval: 5,
          collaborationEnabled: true,
          maxCollaborators: 10,
          publicAccess: false,
          allowFileUpload: true,
          allowTerminalAccess: true,
          allowNetworkAccess: true,
          timeoutMinutes: 60,
          snapshotRetention: 7
        }
      };
      
      setLabInstance(mockInstance);
    } catch (err: any) {
      setError('Failed to create lab');
    } finally {
      setIsLoading(false);
    }
  }, [labId, userId]);

  const startLab = useCallback(async () => {
    if (!labInstance) return;
    
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    setLabInstance(prev => prev ? { ...prev, status: 'running' } : null);
    setIsLoading(false);
  }, [labInstance]);

  const stopLab = useCallback(async () => {
    if (!labInstance) return;
    
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    setLabInstance(prev => prev ? { ...prev, status: 'stopped' } : null);
    setIsLoading(false);
  }, [labInstance]);

  const restartLab = useCallback(async () => {
    if (!labInstance) return;
    
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setLabInstance(prev => prev ? { ...prev, status: 'running' } : null);
    setIsLoading(false);
  }, [labInstance]);

  const saveSnapshot = useCallback(async () => {
    if (!labInstance) return;
    
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 800));
    console.log('Snapshot saved (mock)');
    setIsLoading(false);
  }, [labInstance]);

  const loadSnapshot = useCallback(async (snapshotId: string) => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('Snapshot loaded (mock):', snapshotId);
    setIsLoading(false);
  }, []);

  const getFileTree = useCallback(async () => {
    // Return mock file tree
    return [
      {
        name: 'main.py',
        path: 'main.py',
        type: 'file' as const,
        size: 1024,
        extension: '.py',
        lastModified: new Date().toISOString(),
        permissions: 'rw-r--r--',
        owner: 'user'
      },
      {
        name: 'src',
        path: 'src',
        type: 'folder' as const,
        children: [
          {
            name: 'app.py',
            path: 'src/app.py',
            type: 'file' as const,
            size: 512,
            extension: '.py',
            lastModified: new Date().toISOString(),
            permissions: 'rw-r--r--',
            owner: 'user'
          }
        ],
        permissions: 'rwxr-xr-x',
        owner: 'user'
      }
    ];
  }, []);

  const createFile = useCallback(async (path: string, content: string = '') => {
    console.log('Mock creating file:', path);
    await new Promise(resolve => setTimeout(resolve, 200));
  }, []);

  const deleteFile = useCallback(async (path: string) => {
    console.log('Mock deleting file:', path);
    await new Promise(resolve => setTimeout(resolve, 200));
  }, []);

  const renameFile = useCallback(async (oldPath: string, newPath: string) => {
    console.log('Mock renaming file:', oldPath, 'to', newPath);
    await new Promise(resolve => setTimeout(resolve, 200));
  }, []);

  return {
    labInstance,
    isLoading,
    error,
    createLab,
    startLab,
    stopLab, 
    restartLab,
    saveSnapshot,
    loadSnapshot,
    getFileTree,
    createFile,
    deleteFile,
    renameFile
  };
};
