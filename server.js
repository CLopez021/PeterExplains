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
  console.log('=== RENDER REQUEST RECEIVED ===');
  console.log('Request timestamp:', new Date().toISOString());
  
  const files = req.files;
  console.log('Files received:', files ? Object.keys(files) : 'None');
  
  if (!files || !files.audioFile) {
    console.log('ERROR: Missing audio file');
    return res.status(400).json({ success: false, logs: 'Missing audio file' });
  }
  
  console.log('Audio file info:', {
    originalname: files.audioFile[0].originalname,
    mimetype: files.audioFile[0].mimetype,
    size: files.audioFile[0].size,
    path: files.audioFile[0].path
  });
  // Use default images/videos when none uploaded - pass absolute paths to main.ts
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
  console.log(`=== SPAWNING CHILD PROCESS ===`);
  console.log(`Script path: ${scriptPath}`);
  console.log(`Arguments: ${JSON.stringify(args)}`);
  console.log(`Command: node --loader ts-node/esm ${scriptPath} ${args.join(' ')}`);
  
  const child = spawn('node', [
    '--loader', 'ts-node/esm',
    '--experimental-specifier-resolution=node',
    scriptPath, 
    ...args
  ], {
    stdio: ['inherit', 'pipe', 'pipe'],
    env: { ...process.env, TS_NODE_ESM: '1' }
  });

  let logs = '';
  
  child.stdout.on('data', (data) => {
    const logChunk = data.toString();
    console.log('STDOUT:', logChunk);
    logs += `[STDOUT] ${logChunk}`;
  });
  
  child.stderr.on('data', (data) => {
    const logChunk = data.toString();
    console.error('STDERR:', logChunk);
    logs += `[STDERR] ${logChunk}`;
  });
  
  child.on('error', (error) => {
    console.error('Process spawn error:', error);
    logs += `[ERROR] Failed to spawn process: ${error.message}\n`;
  });

  child.on('close', (code) => {
    logs += `\n[PROCESS] Exited with code ${code}\n`;
    console.log(`=== CHILD PROCESS CLOSED ===`);
    console.log(`Exit code: ${code}`);
    console.log(`Total logs length: ${logs.length} characters`);
    
    // Cleanup uploaded files (main.ts will handle the uploads folder cleanup)
    console.log('=== CLEANING UP FILES ===');
    [audioFilePath, stewieImagePath, peterImagePath, backgroundVideoPath].forEach((filePath) => {
      if (filePath && filePath.startsWith(uploadDest)) {
        try {
          fs.unlinkSync(filePath);
          console.log(`  ✓ Deleted: ${filePath}`);
        } catch (err) {
          console.log(`  ✗ Failed to delete: ${filePath} - ${err.message}`);
        }
      } else if (filePath) {
        console.log(`  - Skipped (default file): ${filePath}`);
      }
    });
    
    if (code !== 0) {
      console.log('=== RENDER FAILED ===');
      return res.status(500).json({ success: false, logs });
    }
    
    console.log('=== RENDER SUCCESS ===');
    console.log(`Output file: ${outputFileName}`);
    return res.json({ success: true, logs, videoUrl: `/outputs/${outputFileName}` });
  });
});

app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log(`🚀 PeterExplains Server Started`);
  console.log(`📅 Timestamp: ${new Date().toISOString()}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`📁 Upload directory: ${uploadDest}`);
  console.log(`📁 Output directory: ${path.join(__dirname, 'outputs')}`);
  console.log(`📄 TypeScript script: ${path.join(__dirname, 'src', 'main.ts')}`);
  console.log('='.repeat(50));
}); 