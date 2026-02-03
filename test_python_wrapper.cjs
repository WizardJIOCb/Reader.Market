const { spawn } = require('child_process');
const fs = require('fs');

// Test the Python wrapper script with JSON input
const params = {
  model: 'C:\\opt\\piper\\models\\ru_RU-irina-medium.onnx',
  output_file: 'C:\\Projects\\reader.market\\temp_python_test.wav',
  length_scale: 1,
  text: 'Привет мир'
};

console.log('Testing Python wrapper with params:', params);

const proc = spawn('python', ['scripts\\tts_wrapper.py']);

let stdout = '';
let stderr = '';

proc.stdout.on('data', (data) => {
  stdout += data.toString();
});

proc.stderr.on('data', (data) => {
  stderr += data.toString();
});

proc.on('close', (code) => {
  console.log(`Process exited with code ${code}`);
  console.log('STDOUT:', stdout);
  console.log('STDERR:', stderr);
  
  // Check if the output file was created
  fs.access('C:\\Projects\\reader.market\\temp_python_test.wav', fs.constants.F_OK, (err) => {
    if (err) {
      console.log('Output file was not created or is empty');
    } else {
      fs.stat('C:\\Projects\\reader.market\\temp_python_test.wav', (err, stats) => {
        if (err) {
          console.log('Error getting file stats:', err);
        } else {
          console.log(`Output file size: ${stats.size} bytes`);
        }
      });
    }
  });
});

// Send JSON parameters to stdin
proc.stdin.write(JSON.stringify(params));
proc.stdin.end();