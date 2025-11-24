#!/usr/bin/env node

/**
 * Start script for Facebook Group Automation
 * Handles pre-flight checks and initialization
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Facebook Group Automation - Starting...\n');

// Check Node.js version
function checkNodeVersion() {
    const requiredVersion = 16;
    const currentVersion = parseInt(process.version.split('.')[0].replace('v', ''));
    
    if (currentVersion < requiredVersion) {
        console.error(`❌ Error: Node.js version ${requiredVersion}+ is required. Current: ${process.version}`);
        process.exit(1);
    }
    
    console.log(`✅ Node.js version: ${process.version}`);
}

// Check if node_modules exists
function checkDependencies() {
    const nodeModulesPath = path.join(__dirname, 'node_modules');
    
    if (!fs.existsSync(nodeModulesPath)) {
        console.log('📦 Installing dependencies...');
        try {
            execSync('npm install', { stdio: 'inherit' });
            console.log('✅ Dependencies installed successfully\n');
        } catch (error) {
            console.error('❌ Error installing dependencies');
            process.exit(1);
        }
    } else {
        console.log('✅ Dependencies found\n');
    }
}

// Create necessary directories
function createDirectories() {
    const dirs = [
        path.join(__dirname, 'user-data'),
        path.join(__dirname, 'logs')
    ];
    
    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`✅ Created directory: ${path.basename(dir)}`);
        }
    });
}

// Check Chromium for Puppeteer
function checkChromium() {
    const puppeteerPath = path.join(__dirname, 'node_modules', 'puppeteer-core');
    
    if (fs.existsSync(puppeteerPath)) {
        console.log('✅ Puppeteer ready');
    } else {
        console.log('⚠️  Puppeteer not found, will be installed with dependencies');
    }
}

// Main function
function main() {
    try {
        console.log('🔍 Running pre-flight checks...\n');
        
        checkNodeVersion();
        checkDependencies();
        createDirectories();
        checkChromium();
        
        console.log('\n✨ All checks passed! Starting application...\n');
        
        // Start Electron
        const electron = require('electron');
        const proc = require('child_process');
        
        const child = proc.spawn(electron, ['.'], { stdio: 'inherit' });
        
        child.on('close', (code) => {
            console.log(`\n👋 Application closed with code: ${code}`);
            process.exit(code);
        });
        
    } catch (error) {
        console.error('\n❌ Error during startup:', error.message);
        process.exit(1);
    }
}

// Run if executed directly
if (require.main === module) {
    main();
}

module.exports = { main };
