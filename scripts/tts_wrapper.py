#!/usr/bin/env python3
"""
Wrapper script for Piper TTS to handle Windows path issues properly
"""

import sys
import os
import json
import subprocess
import tempfile

def main():
    try:
        # Read parameters from stdin as JSON
        input_data = json.loads(sys.stdin.read())
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON input: {e}", file=sys.stderr)
        sys.exit(1)
    
    model_path = input_data.get('model')
    output_path = input_data.get('output_file')
    length_scale = input_data.get('length_scale', 1.0)
    
    # Print arguments for debugging
    print(f"Model path received: {repr(model_path)}", file=sys.stderr)
    print(f"Output file received: {repr(output_path)}", file=sys.stderr)
    
    # Use os.path.abspath to get absolute paths
    model_path = os.path.abspath(model_path)
    output_path = os.path.abspath(output_path)
    
    print(f"Absolute model path: {repr(model_path)}", file=sys.stderr)
    print(f"Absolute output path: {repr(output_path)}", file=sys.stderr)
    
    # Check if model file exists
    if not os.path.exists(model_path):
        print(f"Model file does not exist: {model_path}", file=sys.stderr)
        print(f"Current working directory: {os.getcwd()}", file=sys.stderr)
        sys.exit(1)
    
    # Check if model config file exists (the .json file)
    config_path = model_path + ".json"
    if not os.path.exists(config_path):
        print(f"Model config file does not exist: {config_path}", file=sys.stderr)
        sys.exit(1)
    
    # Get the text from the input data
    text = input_data.get('text', '')
    
    # Create a temporary file for the input text
    temp_input_path = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt', encoding='utf-8') as temp_input:
            temp_input.write(text)
            temp_input_path = temp_input.name
        
        # Build the Piper command - use 'piper' directly, assuming it's in PATH
        cmd = [
            'piper',
            '--model', model_path,
            '--input-file', temp_input_path,
            '--output-file', output_path,
            '--length-scale', str(length_scale)
        ]
        
        print(f"Executing command: {' '.join(cmd)}", file=sys.stderr)
        
        # Execute the Piper command
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout
        )
        
        print(f"Piper exit code: {result.returncode}", file=sys.stderr)
        if result.stdout:
            print(f"Piper stdout: {result.stdout}", file=sys.stderr)
        if result.stderr:
            print(f"Piper stderr: {result.stderr}", file=sys.stderr)
            
        if result.returncode != 0:
            print(f"Piper failed with return code {result.returncode}", file=sys.stderr)
            sys.exit(result.returncode)
        
        # Verify the file was written
        if os.path.exists(output_path):
            size = os.path.getsize(output_path)
            print(f"Audio file written with size: {size} bytes", file=sys.stderr)
        else:
            print("Audio file was not created", file=sys.stderr)
            sys.exit(1)
            
    except subprocess.TimeoutExpired:
        print("Piper command timed out", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error during Piper execution: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        # Clean up the temporary file
        if temp_input_path and os.path.exists(temp_input_path):
            try:
                os.unlink(temp_input_path)
            except OSError:
                pass  # Ignore errors when cleaning up temp file

if __name__ == '__main__':
    main()