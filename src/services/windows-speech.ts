import { spawn, ChildProcess } from 'child_process';

const PS_SCRIPT = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Speech
$engine = New-Object System.Speech.Recognition.SpeechRecognitionEngine
$engine.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
$engine.SetInputToDefaultAudioDevice()
$engine.Add_SpeechRecognized({
  param($sender, $e)
  [Console]::Out.WriteLine($e.Result.Text)
  [Console]::Out.Flush()
})
$engine.RecognizeAsync([System.Speech.Recognition.RecognizeMode]::Multiple)
try { while($true) { Start-Sleep -Milliseconds 500 } } finally { $engine.RecognizeAsyncCancel(); $engine.Dispose() }
`;

let psProcess: ChildProcess | null = null;
let accumulatedText = '';

export function startWindowsSpeech(): void {
  stopWindowsSpeech();
  accumulatedText = '';

  psProcess = spawn('powershell', [
    '-NoProfile',
    '-NoLogo',
    '-ExecutionPolicy', 'Bypass',
    '-Command', PS_SCRIPT,
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  psProcess.stdout?.setEncoding('utf8');
  psProcess.stdout?.on('data', (data: string) => {
    const lines = data.split(/\r?\n/).filter(l => l.trim());
    for (const line of lines) {
      accumulatedText += (accumulatedText ? ' ' : '') + line.trim();
    }
  });

  psProcess.stderr?.setEncoding('utf8');
  psProcess.stderr?.on('data', (data: string) => {
    console.error('[WindowsSpeech] stderr:', data.trim());
  });

  psProcess.on('error', (err) => {
    console.error('[WindowsSpeech] process error:', err.message);
  });
}

export function stopWindowsSpeech(): string {
  if (psProcess) {
    try { psProcess.kill(); } catch { /* ignore */ }
    psProcess = null;
  }
  const text = accumulatedText;
  accumulatedText = '';
  return text;
}

export function getAccumulatedText(): string {
  return accumulatedText;
}
