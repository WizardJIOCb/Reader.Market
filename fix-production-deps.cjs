// Script to fix production dependencies for Ollama-Reader build
// This script should be run on the production server to move esbuild, vite, and tsx to dependencies
// Uses CommonJS syntax but with .cjs extension to work with "type": "module" in package.json

const fs = require('fs');
const path = require('path');

// Read the package.json file
const packageJsonPath = path.join(process.cwd(), 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Check if esbuild, vite, and tsx are in devDependencies
const hasEsbuildInDevDeps = packageJson.devDependencies && packageJson.devDependencies['esbuild'];
const hasViteInDevDeps = packageJson.devDependencies && packageJson.devDependencies['vite'];
const hasTsxInDevDeps = packageJson.devDependencies && packageJson.devDependencies['tsx'];

// Move esbuild from devDependencies to dependencies if it exists
if (hasEsbuildInDevDeps) {
    if (!packageJson.dependencies) {
        packageJson.dependencies = {};
    }
    packageJson.dependencies['esbuild'] = packageJson.devDependencies['esbuild'];
    delete packageJson.devDependencies['esbuild'];
    console.log('Moved esbuild from devDependencies to dependencies');
}

// Move vite from devDependencies to dependencies if it exists
if (hasViteInDevDeps) {
    if (!packageJson.dependencies) {
        packageJson.dependencies = {};
    }
    packageJson.dependencies['vite'] = packageJson.devDependencies['vite'];
    delete packageJson.devDependencies['vite'];
    console.log('Moved vite from devDependencies to dependencies');
}

// Move tsx from devDependencies to dependencies if it exists
if (hasTsxInDevDeps) {
    if (!packageJson.dependencies) {
        packageJson.dependencies = {};
    }
    packageJson.dependencies['tsx'] = packageJson.devDependencies['tsx'];
    delete packageJson.devDependencies['tsx'];
    console.log('Moved tsx from devDependencies to dependencies');
}

// Write the updated package.json back to disk
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
console.log('Updated package.json successfully');