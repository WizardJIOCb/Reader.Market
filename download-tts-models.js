/**
 * Script to download TTS voice models for Piper
 */

import fs from 'fs';
import https from 'https';
import path from 'path';
import { pipeline } from 'stream/promises';

// Create models directory if it doesn't exist
const modelsDir = 'C:\\opt\\piper\\models';
if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
    console.log('✅ Created models directory:', modelsDir);
} else {
    console.log('✅ Models directory exists:', modelsDir);
}

// Model URLs to download
const models = [
    {
        url: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx',
        filename: 'en_US-lessac-medium.onnx'
    },
    {
        url: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/ru/ru_RU/irina/medium/ru_RU-irina-medium.onnx',
        filename: 'ru_RU-irina-medium.onnx'
    },
    {
        url: 'https://huggingface.co/rhasspy/piper-voices/raw/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json',
        filename: 'en_US-lessac-medium.onnx.json'
    },
    {
        url: 'https://huggingface.co/rhasspy/piper-voices/raw/main/ru/ru_RU/irina/medium/ru_RU-irina-medium.onnx.json',
        filename: 'ru_RU-irina-medium.onnx.json'
    }
];

// Function to download a file with redirect support
async function downloadFile(url, filepath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath);
        
        function downloadWithRedirect(currentUrl) {
            https.get(currentUrl, (response) => {
                if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307) {
                    const redirectUrl = response.headers.location;
                    if (redirectUrl) {
                        console.log(`🔄 Following redirect to: ${redirectUrl}`);
                        downloadWithRedirect(redirectUrl);
                    } else {
                        reject(new Error(`Redirect without location header: ${response.statusCode}`));
                    }
                    return;
                }
                
                if (response.statusCode !== 200) {
                    reject(new Error(`Failed to download ${url}: ${response.statusCode} ${response.statusMessage}`));
                    return;
                }
                
                response.pipe(file);
                
                file.on('finish', () => {
                    file.close();
                    console.log(`✅ Downloaded: ${path.basename(filepath)}`);
                    resolve();
                });
                
                file.on('error', (err) => {
                    fs.unlink(filepath, () => {}); // Delete the file async
                    reject(err);
                });
            }).on('error', (err) => {
                reject(err);
            });
        }
        
        downloadWithRedirect(url);
    });
}

// Download all models
async function downloadAllModels() {
    console.log('📥 Starting download of TTS voice models...\n');
    
    for (const model of models) {
        const filepath = path.join(modelsDir, model.filename);
        
        if (fs.existsSync(filepath)) {
            console.log(`⏭️ Skipping ${model.filename} (already exists)`);
            continue;
        }
        
        console.log(`⬇️ Downloading ${model.filename}...`);
        
        try {
            await downloadFile(model.url, filepath);
        } catch (error) {
            console.error(`❌ Failed to download ${model.filename}:`, error.message);
        }
    }
    
    // Verify downloaded files
    console.log('\n🔍 Verifying downloaded models...');
    const files = fs.readdirSync(modelsDir).filter(f => f.endsWith('.onnx'));
    
    if (files.length > 0) {
        files.forEach(file => {
            const stats = fs.statSync(path.join(modelsDir, file));
            const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
            console.log(`  ✅ ${file} - ${sizeInMB} MB`);
        });
        console.log(`\n🎉 Successfully downloaded ${files.length} TTS voice model(s)!`);
    } else {
        console.log('❌ No model files were downloaded');
    }
    
    console.log('\n✨ TTS voice models setup completed!');
    console.log('You can now use TTS functionality in the application.');
}

// Run the download
downloadAllModels().catch(console.error);