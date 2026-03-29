import { clipboard } from 'electron';
import { execFile } from 'child_process';

export async function insertText(text: string): Promise<void> {
  const previousText = clipboard.readText();

  clipboard.writeText(text);

  await new Promise(resolve => setTimeout(resolve, 100));

  await simulatePaste();

  await new Promise(resolve => setTimeout(resolve, 300));

  clipboard.writeText(previousText);
}

function simulatePaste(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (process.platform === 'win32') {
      execFile(
        'powershell',
        [
          '-NoProfile', '-NonInteractive', '-Command',
          'Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("^v")',
        ],
        { windowsHide: true },
        (error) => (error ? reject(error) : resolve()),
      );
    } else if (process.platform === 'darwin') {
      execFile(
        'osascript',
        ['-e', 'tell application "System Events" to keystroke "v" using command down'],
        (error) => (error ? reject(error) : resolve()),
      );
    } else {
      execFile(
        'xdotool',
        ['key', 'ctrl+v'],
        (error) => (error ? reject(error) : resolve()),
      );
    }
  });
}
