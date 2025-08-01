import { execSync } from 'child_process';
import { setTimeout } from 'timers/promises';

export async function setup() {
  console.log('🐳 Starting Docker Compose for integration tests...');
  
  try {
    // Start Docker Compose services
    execSync('docker-compose -f tests/integration/docker-compose.test.yml up -d', { 
      stdio: 'inherit',
      timeout: 120000 // 2 minutes timeout
    });
    
    console.log('⏳ Waiting for Cubicler to be ready...');
    
    // Wait for services to be ready
    await waitForCubicler();
    
    console.log('✅ Cubicler is ready for integration tests');
  } catch (error) {
    console.error('❌ Failed to start Docker services:', error);
    throw error;
  }
}

export async function teardown() {
  console.log('🧹 Cleaning up Docker Compose services...');
  
  try {
    execSync('docker-compose -f tests/integration/docker-compose.test.yml down -v', { 
      stdio: 'inherit',
      timeout: 60000 // 1 minute timeout
    });
    console.log('✅ Docker services cleaned up');
  } catch (error) {
    console.error('❌ Failed to clean up Docker services:', error);
    // Don't throw here as it might mask test failures
  }
}

async function waitForCubicler(maxAttempts = 30, delayMs = 2000): Promise<void> {
  const cubiclerUrl = process.env.CUBICLER_URL || 'http://localhost:1504';
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(`${cubiclerUrl}/health`);
      if (response.ok) {
        return;
      }
    } catch (error) {
      // Service not ready yet
    }
    
    console.log(`⏳ Attempt ${attempt}/${maxAttempts} - Waiting for Cubicler...`);
    await setTimeout(delayMs);
  }
  
  throw new Error(`Cubicler did not become ready after ${maxAttempts} attempts`);
}
