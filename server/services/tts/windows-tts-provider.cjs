const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Windows TTS using PowerShell and SAPI
class WindowsTtsProvider {
  constructor() {
    this.id = 'windows';
  }

  async listVoices(lang) {
    try {
      // Get available voices using PowerShell
      const psScript = `
        Add-Type -AssemblyName System.Speech
        $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
        $voices = $synth.GetInstalledVoices() | Where-Object { $_.Enabled -eq $true }
        $voices | ForEach-Object { 
          @{
            Name = $_.VoiceInfo.Name
            Culture = $_.VoiceInfo.Culture.Name
            Gender = $_.VoiceInfo.Gender
            Age = $_.VoiceInfo.Age
          }
        } | ConvertTo-Json
      `;

      const result = await this.runPowerShell(psScript);
      const voices = JSON.parse(result);
      
      // Filter by language
      const langPrefix = lang === 'ru' ? 'ru' : 'en';
      return voices
        .filter(v => v.Culture && v.Culture.toLowerCase().startsWith(langPrefix))
        .map(v => ({
          id: v.Name,
          name: `${v.Name} (${v.Culture})`
        }));
    } catch (error) {
      console.error('Error listing Windows voices:', error);
      return [];
    }
  }

  async synthesizeToWav(text, options, wavOutPath) {
    try {
      // Create temporary SSML file
      // Simplified SSML for Windows Speech API compatibility
      const cleanText = text
        .replace(/<[^<>]*>/g, ' ')  // Remove HTML tags (non-greedy)
        .replace(/\s+/g, ' ')       // Normalize whitespace
        .replace(/["']/g, '')       // Remove quotes that might interfere with SSML
        .trim();
      
      const ssmlContent = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${options.lang}">
        <voice name="${options.voice}">
          <prosody rate="${options.rate}">${cleanText}</prosody>
        </voice>
      </speak>`;
      
      console.log('Windows TTS: Cleaned text length:', cleanText.length);
      console.log('Windows TTS: Cleaned text preview:', cleanText.substring(0, 100));

      const tempSsmlPath = path.join(require('os').tmpdir(), `tts-${Date.now()}.xml`);
      fs.writeFileSync(tempSsmlPath, ssmlContent, 'utf8');

      // PowerShell script to generate audio
      const psScript = `
        Add-Type -AssemblyName System.Speech
        $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
        $synth.Rate = [Math]::Round((${options.rate} - 1) * 10)  # Convert 0.8-1.25 to -2 to 2
        $synth.SelectVoice('${options.voice}')
              
        Write-Host "Selected voice: ${options.voice}"
        Write-Host "Rate: ${options.rate}"
        Write-Host "Output file: ${wavOutPath.replace(/\\/g, '\\')}"
              
        $stream = New-Object System.IO.FileStream('${wavOutPath.replace(/\\/g, '\\')}', [System.IO.FileMode]::Create)
        $synth.SetOutputToWaveStream($stream)
        $synth.SpeakSsml([System.IO.File]::ReadAllText('${tempSsmlPath.replace(/\\/g, '\\')}'))
        $stream.Close()
              
        # Check if file was created
        if (Test-Path '${wavOutPath.replace(/\\/g, '\\')}') {
          $fileInfo = Get-Item '${wavOutPath.replace(/\\/g, '\\')}'
          Write-Host "File size: $($fileInfo.Length) bytes"
        } else {
          Write-Host "ERROR: File was not created!"
        }
              
        # $synth.Dispose()  # Removed to avoid disposal error
      `;

      await this.runPowerShell(psScript);
      
      // Clean up temp file
      if (fs.existsSync(tempSsmlPath)) {
        fs.unlinkSync(tempSsmlPath);
      }

      // Verify file was created
      if (!fs.existsSync(wavOutPath)) {
        throw new Error('Audio file was not generated');
      }

      console.log(`Windows TTS: Generated ${wavOutPath} (${fs.statSync(wavOutPath).size} bytes)`);
    } catch (error) {
      console.error('Windows TTS synthesis failed:', error);
      throw error;
    }
  }

  escapeXml(unsafe) {
    return unsafe.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
  }

  runPowerShell(script) {
    return new Promise((resolve, reject) => {
      console.log('Executing PowerShell script:');
      console.log(script);
      
      const ps = spawn('powershell', ['-Command', script], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      ps.stdout.on('data', (data) => {
        stdout += data.toString();
        console.log('PowerShell stdout:', data.toString());
      });

      ps.stderr.on('data', (data) => {
        stderr += data.toString();
        console.log('PowerShell stderr:', data.toString());
      });

      ps.on('close', (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(`PowerShell exited with code ${code}: ${stderr}`));
        }
      });

      ps.on('error', (err) => {
        reject(err);
      });
    });
  }
}

module.exports = WindowsTtsProvider;