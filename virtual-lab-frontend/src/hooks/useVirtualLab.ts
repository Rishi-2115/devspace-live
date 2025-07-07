import { useState, useEffect, useCallback } from 'react';
import { VirtualLabInstance, FileNode, LabConfig } from '../types/virtualLab';
import { api } from '../services/api';

export const useVirtualLab = (labId: string, userId: string) => {
  const [labInstance, setLabInstance] = useState<VirtualLabInstance | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createLab = useCallback(async (config: LabConfig) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await api.post('/virtual-lab/create', {
        labId,
        userId,
        ...config
      });
      setLabInstance(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create lab');
    } finally {
      setIsLoading(false);
    }
  }, [labId, userId]);

  const startLab = useCallback(async () => {
    if (!labInstance) return;
    
    setIsLoading(true);
    try {
      const response = await api.post(`/virtual-lab/${labId}/start`);
      setLabInstance(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to start lab');
    } finally {
      setIsLoading(false);
    }
  }, [labId, labInstance]);

  const stopLab = useCallback(async () => {
    if (!labInstance) return;
    
    setIsLoading(true);
    try {
      const response = await api.post(`/virtual-lab/${labId}/stop`);
      setLabInstance(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to stop lab');
    } finally {
      setIsLoading(false);
    }
  }, [labId, labInstance]);

  const restartLab = useCallback(async () => {
    if (!labInstance) return;
    
    setIsLoading(true);
    try {
      const response = await api.post(`/virtual-lab/${labId}/restart`);
      setLabInstance(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to restart lab');
    } finally {
      setIsLoading(false);
    }
  }, [labId, labInstance]);

  const saveSnapshot = useCallback(async (name?: string) => {
    if (!labInstance) return;
    
    try {
      await api.post(`/virtual-lab/${labId}/snapshot`, { name });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save snapshot');
    }
  }, [labId, labInstance]);

  const loadSnapshot = useCallback(async (snapshotId: string) => {
    if (!labInstance) return;
    
    setIsLoading(true);
    try {
      const response = await api.post(`/virtual-lab/${labId}/snapshot/${snapshotId}/restore`);
      setLabInstance(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load snapshot');
    } finally {
      setIsLoading(false);
    }
  }, [labId, labInstance]);

  const getFileTree = useCallback(async (): Promise<FileNode[]> => {
    try {
      const response = await api.get(`/virtual-lab/${labId}/files`);
      // Backend returns { files: [...], totalSize: ..., fileCount: ... }
      // Extract the files array
      return response.data.files || response.data || [];
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to get file tree');
      return [];
    }
  }, [labId]);

  const createFile = useCallback(async (path: string, content: string = '') => {
    try {
      await api.post(`/virtual-lab/${labId}/files`, { path, content });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create file');
    }
  }, [labId]);

  const deleteFile = useCallback(async (path: string) => {
    try {
      await api.delete(`/virtual-lab/${labId}/files`, { data: { path } });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete file');
    }
  }, [labId]);

  const renameFile = useCallback(async (oldPath: string, newPath: string) => {
    try {
      await api.put(`/virtual-lab/${labId}/files/rename`, { oldPath, newPath });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to rename file');
    }
  }, [labId]);

  const executeCode = useCallback(async (code: string, language: string) => {
    try {
      const response = await api.post(`/virtual-lab/${labId}/execute`, { code, language });
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to execute code');
      return null;
    }
  }, [labId]);

  // Fetch lab instance on mount
  useEffect(() => {
    const fetchLabInstance = async () => {
      setIsLoading(true);
      setError(null);
      try {
        console.log('Fetching lab instance for labId:', labId);
        const response = await api.get(`/virtual-lab/${labId}`);
        console.log('Lab instance response:', response.data);
        setLabInstance(response.data);
      } catch (err: any) {
        console.error('Error fetching lab instance:', err);
        if (err.response?.status !== 404) {
          setError(err.response?.data?.message || err.message || 'Failed to fetch lab instance');
        }
      } finally {
        setIsLoading(false);
      }
    };

    if (labId) {
      fetchLabInstance();
    }
  }, [labId]);

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
    renameFile,
    executeCode
  };
};
