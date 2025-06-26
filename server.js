/* eslint-disable no-console, no-undef */
/* eslint-env node */
import express from 'express';
import multer from 'multer';
import path from 'path';
import { spawn } from 'child_process';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const uploadDest = path.join(__dirname, 'public', 'uploads');
const upload = multer({ dest: uploadDest });
const PORT = process.env.PORT || 3000;


// Ensure uploads and outputs directories exist
[uploadDest, path.join(__dirname, 'outputs')].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
});

// Serve static files (UI and assets)
app.use(express.static(path.join(__dirname)));
// Serve output videos
app.use('/outputs', express.static(path.join(__dirname, 'outputs')));

// Serve UI at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'ui.html'));
});

app.post('/render', upload.fields([
  { name: 'audioFile', maxCount: 1 },
  { name: 'stewieImage', maxCount: 1 },
  { name: 'peterImage', maxCount: 1 },
  { name: 'backgroundVideo', maxCount: 1 },
]), (req, res) => {
  console.log('Received render request');
  const files = req.files;
  if (!files.audioFile) {
    return res.status(400).json({ success: false, logs: 'Missing audio file' });
  }
  // Use default images/videos when none uploaded
  const audioFilePath = files.audioFile[0].path;
  const stewieImagePath = files.stewieImage
    ? files.stewieImage[0].path
    : path.join(__dirname, 'public', 'characters', 'Stewie_Griffin.png');
  const peterImagePath = files.peterImage
    ? files.peterImage[0].path
    : path.join(__dirname, 'public', 'characters', 'Peter_Griffin.png');
  const backgroundVideoPath = files.backgroundVideo
    ? files.backgroundVideo[0].path
    : path.join(__dirname, 'public', 'minecraft_background.mp4');

  console.log('Using files:', { audioFilePath, stewieImagePath, peterImagePath, backgroundVideoPath });

  const outputFileName = `output_${Date.now()}.mp4`;
  const outputPath = path.join('outputs', outputFileName);

  // Spawn the main.ts script via ts-node
  const args = [
    audioFilePath,
    outputPath,
    stewieImagePath,
    peterImagePath,
  ];
  if (backgroundVideoPath) {
    args.push(backgroundVideoPath);
  }

  // Use node with ts-node ESM loader to execute TypeScript
  const scriptPath = path.join(__dirname, 'src', 'main.ts');
  console.log(`Spawning script: ${scriptPath}`);
  const child = spawn('node', ['--loader', 'ts-node/esm', scriptPath, ...args]);

  let logs = '';
  child.stdout.on('data', (data) => {
    const logChunk = data.toString();
    console.log(logChunk);
    logs += logChunk;
  });
  child.stderr.on('data', (data) => {
    const logChunk = data.toString();
    console.error(logChunk);
    logs += logChunk;
  });

  child.on('close', (code) => {
    logs += `\nProcess exited with code ${code}\n`;
    console.log(`Child process exited with code ${code}`);
    // Cleanup only the files staged under public/uploads
    console.log('Cleaning up uploaded files...');
    [audioFilePath, stewieImagePath, peterImagePath, backgroundVideoPath].forEach((filePath) => {
      if (filePath.startsWith(uploadDest)) {
        try {
          fs.unlinkSync(filePath);
          console.log(`  - Deleted: ${filePath}`);
        } catch { /* ignore cleanup errors */ }
      }
    });
    if (code !== 0) {
      return res.status(500).json({ success: false, logs });
    }
    return res.json({ success: true, logs, videoUrl: `/outputs/${outputFileName}` });
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
}); 