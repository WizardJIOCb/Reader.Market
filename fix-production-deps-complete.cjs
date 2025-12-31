// Complete script to fix production dependencies for Ollama-Reader build
// This script moves all necessary build-time dependencies from devDependencies to dependencies
// Uses CommonJS syntax but with .cjs extension to work with "type": "module" in package.json

const fs = require('fs');
const path = require('path');

// Read the package.json file
const packageJsonPath = path.join(process.cwd(), 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// List of dependencies that are needed during the build process
const buildDependencies = [
    'esbuild',
    'vite',
    'tsx',
    '@vitejs/plugin-react'
];

// Move each required dependency from devDependencies to dependencies
buildDependencies.forEach(dep => {
    if (packageJson.devDependencies && packageJson.devDependencies[dep]) {
        if (!packageJson.dependencies) {
            packageJson.dependencies = {};
        }
        packageJson.dependencies[dep] = packageJson.devDependencies[dep];
        delete packageJson.devDependencies[dep];
        console.log(`Moved ${dep} from devDependencies to dependencies`);
    }
});

// Write the updated package.json back to disk
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
console.log('Updated package.json successfully');