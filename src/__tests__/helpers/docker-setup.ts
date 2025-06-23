import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ContainerConfig {
  name: string;
  image: string;
  port: number;
  healthCheck: () => Promise<boolean>;
  connectionString: string;
}

export class DockerTestHelper {
  private static containers: Map<string, ContainerConfig> = new Map([
    ['mongodb', {
      name: 'cloudtaskmq-test-mongo',
      image: 'mongo:7.0',
      port: 27017,
      healthCheck: async () => {
        try {
          await execAsync('docker exec cloudtaskmq-test-mongo mongosh --eval "db.adminCommand(\'ping\')" --quiet');
          return true;
        } catch {
          return false;
        }
      },
      connectionString: 'mongodb://localhost:27017/cloudtaskmq_test'
    }],
    ['redis', {
      name: 'cloudtaskmq-test-redis',
      image: 'redis:7.2-alpine',
      port: 6379,
      healthCheck: async () => {
        try {
          await execAsync('docker exec cloudtaskmq-test-redis redis-cli ping');
          return true;
        } catch {
          return false;
        }
      },
      connectionString: 'redis://localhost:6379'
    }]
  ]);

  static async startContainer(serviceName: 'mongodb' | 'redis'): Promise<string> {
    const config = this.containers.get(serviceName);
    if (!config) {
      throw new Error(`Unknown service: ${serviceName}`);
    }

    try {
      // Check if container is already running
      const { stdout: runningContainers } = await execAsync('docker ps --format "{{.Names}}"');
      if (runningContainers.includes(config.name)) {
        console.log(`Container ${config.name} is already running`);
        await this.waitForHealthy(config);
        return config.connectionString;
      }

      // Check if container exists but is stopped
      const { stdout: allContainers } = await execAsync('docker ps -a --format "{{.Names}}"');
      if (allContainers.includes(config.name)) {
        console.log(`Starting existing container ${config.name}`);
        await execAsync(`docker start ${config.name}`);
      } else {
        // Start container using docker-compose
        console.log(`Creating and starting container ${config.name}`);
        await execAsync(`docker-compose -f docker-compose.test.yml up -d ${serviceName}`);
      }

      await this.waitForHealthy(config);
      return config.connectionString;
    } catch (error) {
      throw new Error(`Failed to start ${serviceName} container: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  static async stopContainer(serviceName: 'mongodb' | 'redis'): Promise<void> {
    const config = this.containers.get(serviceName);
    if (!config) {
      throw new Error(`Unknown service: ${serviceName}`);
    }

    try {
      console.log(`Stopping container ${config.name}`);
      await execAsync(`docker stop ${config.name}`);
    } catch (error) {
      console.warn(`Failed to stop ${serviceName} container:`, error);
    }
  }

  static async cleanupContainer(serviceName: 'mongodb' | 'redis'): Promise<void> {
    const config = this.containers.get(serviceName);
    if (!config) {
      throw new Error(`Unknown service: ${serviceName}`);
    }

    try {
      console.log(`Cleaning up container ${config.name}`);
      await execAsync(`docker-compose -f docker-compose.test.yml down -v`);
    } catch (error) {
      console.warn(`Failed to cleanup ${serviceName} container:`, error);
    }
  }

  private static async waitForHealthy(config: ContainerConfig, maxAttempts: number = 30): Promise<void> {
    console.log(`Waiting for ${config.name} to be healthy...`);
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const isHealthy = await config.healthCheck();
        if (isHealthy) {
          console.log(`Container ${config.name} is healthy after ${attempt} attempts`);
          return;
        }
      } catch (error) {
        // Health check failed, continue waiting
      }

      if (attempt === maxAttempts) {
        throw new Error(`Container ${config.name} failed to become healthy after ${maxAttempts} attempts`);
      }

      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds between attempts
    }
  }

  static async isDockerRunning(): Promise<boolean> {
    try {
      await execAsync('docker info');
      return true;
    } catch {
      return false;
    }
  }
}
