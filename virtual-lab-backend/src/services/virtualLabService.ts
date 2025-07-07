import Docker from 'dockerode';
import { v4 as uuidv4 } from 'uuid';
import { redis } from '../config/database';
import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs-extra';

interface LabEnvironment {
  id: string;
  studentId: string;
  language: string;
  containerId: string;
  status: 'creating' | 'running' | 'stopped' | 'error';
  createdAt: Date;
  lastActivity: Date;
  resourceLimits: {
    memory: string;
    cpu: string;
    disk: string;
  };
}

interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number;
  memoryUsed: number;
}

export class VirtualLabService extends EventEmitter {
  private docker: Docker;
  private environments: Map<string, LabEnvironment> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    super();
    this.docker = new Docker();
    this.startCleanupScheduler();
  }

  async createLabEnvironment(studentId: string, language: string): Promise<LabEnvironment> {
    const labId = uuidv4();
    const workspaceDir = path.join('/tmp/labs', labId);
    
    try {
      // Create workspace directory
      await fs.ensureDir(workspaceDir);
      await fs.chmod(workspaceDir, 0o755);

      // Create container
      const container = await this.docker.createContainer({
        Image: this.getDockerImage(language),
        name: `lab-${labId}`,
        Env: [
          `LAB_ID=${labId}`,
          `STUDENT_ID=${studentId}`,
          `LANGUAGE=${language}`
        ],
        HostConfig: {
          Memory: this.getMemoryLimit(language),
          CpuQuota: 50000, // 0.5 CPU
          CpuPeriod: 100000,
          NetworkMode: 'none', // No network access for security
          ReadonlyRootfs: false,
          Binds: [
            `${workspaceDir}:/workspace:rw`
          ],
          Ulimits: [
            { Name: 'nproc', Soft: 64, Hard: 64 }, // Limit processes
            { Name: 'fsize', Soft: 10485760, Hard: 10485760 } // 10MB file size limit
          ]
        },
        WorkingDir: '/workspace',
        Cmd: ['/bin/bash', '-c', 'while true; do sleep 30; done'], // Keep container alive
        AttachStdout: true,
        AttachStderr: true,
        AttachStdin: true,
        OpenStdin: true,
        StdinOnce: false,
        Tty: true
      });

      await container.start();

      const environment: LabEnvironment = {
        id: labId,
        studentId,
        language,
        containerId: container.id,
        status: 'running',
        createdAt: new Date(),
        lastActivity: new Date(),
        resourceLimits: {
          memory: this.getMemoryLimit(language).toString(),
          cpu: '0.5',
          disk: '100MB'
        }
      };

      this.environments.set(labId, environment);
      
      // Store in Redis for persistence
      await redis.setex(`lab:${labId}`, 3600, JSON.stringify(environment));
      await redis.sadd(`student:${studentId}:labs`, labId);

      this.emit('lab-created', environment);
      return environment;

    } catch (error) {
      console.error('Error creating lab environment:', error);
      throw new Error('Failed to create lab environment');
    }
  }

  async executeCode(labId: string, code: string, filename: string): Promise<ExecutionResult> {
    const environment = this.environments.get(labId);
    if (!environment) {
      throw new Error('Lab environment not found');
    }

    const container = this.docker.getContainer(environment.containerId);
    const startTime = Date.now();

    try {
      // Write code to file in container
      const writeExec = await container.exec({
        Cmd: ['sh', '-c', `cat > ${filename}`],
        AttachStdin: true,
        AttachStdout: true,
        AttachStderr: true
      });

      const writeStream = await writeExec.start({ stdin: true });
      writeStream.write(code);
      writeStream.end();

      // Execute the code
      const executeCommand = this.getExecuteCommand(environment.language, filename);
      const execExec = await container.exec({
        Cmd: ['sh', '-c', executeCommand],
        AttachStdout: true,
        AttachStderr: true
      });

      const execStream = await execExec.start({});
      
      let stdout = '';
      let stderr = '';

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Execution timeout'));
        }, 30000); // 30 second timeout

        execStream.on('data', (chunk) => {
          const data = chunk.toString();
          if (chunk[0] === 1) { // stdout
            stdout += data.slice(8);
          } else if (chunk[0] === 2) { // stderr
            stderr += data.slice(8);
          }
        });

        execStream.on('end', async () => {
          clearTimeout(timeout);
          
          const execInfo = await execExec.inspect();
          const executionTime = Date.now() - startTime;
          
          // Get memory usage
          const stats = await container.stats({ stream: false });
          const memoryUsed = stats.memory_stats.usage || 0;

          // Update last activity
          environment.lastActivity = new Date();
                    await redis.setex(`lab:${labId}`, 3600, JSON.stringify(environment));

          const result: ExecutionResult = {
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            exitCode: execInfo.ExitCode || 0,
            executionTime,
            memoryUsed
          };

          resolve(result);
        });

        execStream.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

    } catch (error) {
      console.error('Code execution error:', error);
      throw new Error('Failed to execute code');
    }
  }

  async createTerminalSession(labId: string): Promise<WebSocket> {
    const environment = this.environments.get(labId);
    if (!environment) {
      throw new Error('Lab environment not found');
    }

    const container = this.docker.getContainer(environment.containerId);
    
    try {
      const exec = await container.exec({
        Cmd: ['/bin/bash'],
        AttachStdin: true,
        AttachStdout: true,
        AttachStderr: true,
        Tty: true
      });

      const stream = await exec.start({
        hijack: true,
        stdin: true
      });

      // Create WebSocket server for terminal
      const wss = new WebSocket.Server({ port: 0 });
      
      wss.on('connection', (ws) => {
        // Forward WebSocket messages to container
        ws.on('message', (data) => {
          stream.write(data);
        });

        // Forward container output to WebSocket
        stream.on('data', (data) => {
          ws.send(data);
        });

        stream.on('end', () => {
          ws.close();
        });

        ws.on('close', () => {
          stream.end();
        });
      });

      return wss as any; // Return WebSocket server
    } catch (error) {
      console.error('Terminal session error:', error);
      throw new Error('Failed to create terminal session');
    }
  }

  async uploadFile(labId: string, filename: string, content: Buffer): Promise<void> {
    const environment = this.environments.get(labId);
    if (!environment) {
      throw new Error('Lab environment not found');
    }

    const workspaceDir = path.join('/tmp/labs', labId);
    const filePath = path.join(workspaceDir, filename);

    // Security check - prevent directory traversal
    if (!filePath.startsWith(workspaceDir)) {
      throw new Error('Invalid file path');
    }

    try {
      await fs.writeFile(filePath, content);
      
      // Update last activity
      environment.lastActivity = new Date();
      await redis.setex(`lab:${labId}`, 3600, JSON.stringify(environment));
      
    } catch (error) {
      console.error('File upload error:', error);
      throw new Error('Failed to upload file');
    }
  }

  async downloadFile(labId: string, filename: string): Promise<Buffer> {
    const environment = this.environments.get(labId);
    if (!environment) {
      throw new Error('Lab environment not found');
    }

    const workspaceDir = path.join('/tmp/labs', labId);
    const filePath = path.join(workspaceDir, filename);

    // Security check
    if (!filePath.startsWith(workspaceDir)) {
      throw new Error('Invalid file path');
    }

    try {
      return await fs.readFile(filePath);
    } catch (error) {
      console.error('File download error:', error);
      throw new Error('Failed to download file');
    }
  }

  async listFiles(labId: string, directory: string = '.'): Promise<string[]> {
    const environment = this.environments.get(labId);
    if (!environment) {
      throw new Error('Lab environment not found');
    }

    const container = this.docker.getContainer(environment.containerId);

    try {
      const exec = await container.exec({
        Cmd: ['ls', '-la', directory],
        AttachStdout: true,
        AttachStderr: true
      });

      const stream = await exec.start({});
      let output = '';

      return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => {
          output += chunk.toString();
        });

        stream.on('end', () => {
          const files = output.split('\n')
            .filter(line => line.trim())
            .slice(1) // Remove header
            .map(line => line.split(/\s+/).pop())
            .filter(file => file && file !== '.' && file !== '..');
          
          resolve(files);
        });

        stream.on('error', reject);
      });
    } catch (error) {
      console.error('List files error:', error);
      throw new Error('Failed to list files');
    }
  }

  async getResourceUsage(labId: string): Promise<any> {
    const environment = this.environments.get(labId);
    if (!environment) {
      throw new Error('Lab environment not found');
    }

    const container = this.docker.getContainer(environment.containerId);

    try {
      const stats = await container.stats({ stream: false });
      
      return {
        memory: {
          used: stats.memory_stats.usage,
          limit: stats.memory_stats.limit,
          percentage: (stats.memory_stats.usage / stats.memory_stats.limit) * 100
        },
        cpu: {
          usage: this.calculateCpuUsage(stats.cpu_stats, stats.precpu_stats)
        },
        network: stats.networks,
        disk: stats.blkio_stats
      };
    } catch (error) {
      console.error('Resource usage error:', error);
      throw new Error('Failed to get resource usage');
    }
  }

  async stopLabEnvironment(labId: string): Promise<void> {
    const environment = this.environments.get(labId);
    if (!environment) {
      throw new Error('Lab environment not found');
    }

    try {
      const container = this.docker.getContainer(environment.containerId);
      await container.stop();
      await container.remove();

      // Clean up workspace
      const workspaceDir = path.join('/tmp/labs', labId);
      await fs.remove(workspaceDir);

      // Update status
      environment.status = 'stopped';
      this.environments.delete(labId);

      // Clean up Redis
      await redis.del(`lab:${labId}`);
      await redis.srem(`student:${environment.studentId}:labs`, labId);

      this.emit('lab-stopped', environment);
    } catch (error) {
      console.error('Stop lab error:', error);
      throw new Error('Failed to stop lab environment');
    }
  }

  private getDockerImage(language: string): string {
    const images = {
      'python': 'python:3.9-slim',
      'java': 'openjdk:11-jdk-slim',
      'cpp': 'gcc:latest',
      'c': 'gcc:latest',
      'javascript': 'node:16-slim',
      'go': 'golang:1.19-alpine',
      'rust': 'rust:latest'
    };

    return images[language.toLowerCase()] || 'ubuntu:20.04';
  }

  private getMemoryLimit(language: string): number {
    const limits = {
      'python': 512 * 1024 * 1024, // 512MB
      'java': 1024 * 1024 * 1024,  // 1GB
      'cpp': 256 * 1024 * 1024,    // 256MB
      'c': 256 * 1024 * 1024,      // 256MB
      'javascript': 512 * 1024 * 1024, // 512MB
      'go': 256 * 1024 * 1024,     // 256MB
      'rust': 512 * 1024 * 1024    // 512MB
    };

    return limits[language.toLowerCase()] || 256 * 1024 * 1024;
  }

  private getExecuteCommand(language: string, filename: string): string {
    const commands = {
      'python': `timeout 30 python ${filename}`,
      'java': `javac ${filename} && timeout 30 java ${filename.replace('.java', '')}`,
      'cpp': `g++ -o program ${filename} && timeout 30 ./program`,
      'c': `gcc -o program ${filename} && timeout 30 ./program`,
      'javascript': `timeout 30 node ${filename}`,
      'go': `timeout 30 go run ${filename}`,
      'rust': `rustc ${filename} -o program && timeout 30 ./program`
    };

    return commands[language.toLowerCase()] || `cat ${filename}`;
  }

  private calculateCpuUsage(current: any, previous: any): number {
    const cpuDelta = current.cpu_usage.total_usage - previous.cpu_usage.total_usage;
    const systemDelta = current.system_cpu_usage - previous.system_cpu_usage;
    const cpuCount = current.online_cpus || 1;

    if (systemDelta > 0 && cpuDelta > 0) {
      return (cpuDelta / systemDelta) * cpuCount * 100;
    }
    return 0;
  }

  private startCleanupScheduler(): void {
    this.cleanupInterval = setInterval(async () => {
      const now = new Date();
      const maxIdleTime = 30 * 60 * 1000; // 30 minutes

      for (const [labId, environment] of this.environments) {
        const idleTime = now.getTime() - environment.lastActivity.getTime();
        
        if (idleTime > maxIdleTime) {
          console.log(`Cleaning up idle lab environment: ${labId}`);
          try {
            await this.stopLabEnvironment(labId);
          } catch (error) {
            console.error(`Failed to cleanup lab ${labId}:`, error);
          }
        }
      }
    }, 5 * 60 * 1000); // Check every 5 minutes
  }

  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Stop all running environments
    const stopPromises = Array.from(this.environments.keys()).map(labId =>
      this.stopLabEnvironment(labId).catch(console.error)
    );

    await Promise.all(stopPromises);
  }
}

