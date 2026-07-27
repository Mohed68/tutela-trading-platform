#!/usr/bin/env node

import { spawn } from 'child_process';
import { execSync } from 'child_process';
import { existsSync, rmSync } from 'fs';

console.log('🏗️  Building TUTELA with prerendering...');

async function buildWithPrerender() {
  let serverProcess;
  
  try {
    // Clean previous build
    if (existsSync('dist')) {
      console.log('🧹 Cleaning previous build...');
      rmSync('dist', { recursive: true, force: true });
    }
    
    // Build the application first
    console.log('📦 Building application...');
    execSync('npm run build', { stdio: 'inherit' });
    
    // Start development server for prerendering
    console.log('🌐 Starting server for prerendering...');
    serverProcess = spawn('npm', ['run', 'dev'], {
      stdio: 'pipe',
      detached: false
    });
    
    // Wait for server to be ready
    console.log('⏳ Waiting for server to start...');
    await waitForServer('http://localhost:5000', 30000);
    
    // Run prerender script
    console.log('🎭 Running prerender...');
    execSync('node scripts/prerender.js', { stdio: 'inherit' });
    
    console.log('✅ Build with prerender complete!');
    console.log('📁 Static files generated in dist/public/');
    console.log('🚀 Ready for deployment with SEO-optimized static HTML!');
    
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  } finally {
    if (serverProcess) {
      console.log('🛑 Stopping development server...');
      serverProcess.kill('SIGTERM');
      
      // Force kill if needed
      setTimeout(() => {
        if (!serverProcess.killed) {
          serverProcess.kill('SIGKILL');
        }
      }, 5000);
    }
  }
}

async function waitForServer(url, timeout = 30000) {
  const start = Date.now();
  
  while (Date.now() - start < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        console.log('✅ Server is ready!');
        return;
      }
    } catch (error) {
      // Server not ready yet
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new Error(`Server did not start within ${timeout}ms`);
}

buildWithPrerender();