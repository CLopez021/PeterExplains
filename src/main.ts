#!/usr/bin/env node
/* eslint-env node */
/* global process, console */
import path from 'path';
import fs from 'fs';
import os from 'os';
import { spawnSync } from 'child_process';
import {
  installWhisperCpp,
  downloadWhisperModel,
  transcribe,
  toCaptions,
} from '@remotion/install-whisper-cpp';
// @ts-expect-error no type declarations for whisper-config.mjs
import { WHISPER_PATH, WHISPER_VERSION, WHISPER_MODEL, WHISPER_LANG } from '../whisper-config.mjs';

async function moveFilesToUploads(audioFile: string, stewieImage: string, peterImage: string, backgroundVideo: string) {
  // Create uploads directory if it doesn't exist
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  // Copy files to uploads folder for Remotion staticFile API
  console.log('Copying files to uploads folder...');
  const timestamp = Date.now();
  
  // Copy audio file
  const audioExt = path.extname(audioFile);
  const audioFileName = `audio_${timestamp}${audioExt}`;
  const audioUploadPath = path.join(uploadsDir, audioFileName);
  fs.copyFileSync(audioFile, audioUploadPath);
  console.log(`Audio copied: ${audioFile} -> uploads/${audioFileName}`);
  
  // Copy stewie image
  const stewieExt = path.extname(stewieImage);
  const stewieFileName = `stewie_${timestamp}${stewieExt}`;
  const stewieUploadPath = path.join(uploadsDir, stewieFileName);
  fs.copyFileSync(stewieImage, stewieUploadPath);
  console.log(`Stewie image copied: ${stewieImage} -> uploads/${stewieFileName}`);
  
  // Copy peter image
  const peterExt = path.extname(peterImage);
  const peterFileName = `peter_${timestamp}${peterExt}`;
  const peterUploadPath = path.join(uploadsDir, peterFileName);
  fs.copyFileSync(peterImage, peterUploadPath);
  console.log(`Peter image copied: ${peterImage} -> uploads/${peterFileName}`);
  
  // Copy background video
  const bgExt = path.extname(backgroundVideo);
  const bgFileName = `bg_${timestamp}${bgExt}`;
  const bgUploadPath = path.join(uploadsDir, bgFileName);
  fs.copyFileSync(backgroundVideo, bgUploadPath);
  console.log(`Background video copied: ${backgroundVideo} -> uploads/${bgFileName}`);

  // Use relative paths for Remotion staticFile API
  const audioFileForRemotion = `uploads/${audioFileName}`;
  const stewieImageForRemotion = `uploads/${stewieFileName}`;
  const peterImageForRemotion = `uploads/${peterFileName}`;
  const backgroundVideoForRemotion = `uploads/${bgFileName}`;

  return {
    audioUploadPath,
    stewieUploadPath,
    peterUploadPath,
    bgUploadPath,
    audioFileForRemotion,
    stewieImageForRemotion,
    peterImageForRemotion,
    backgroundVideoForRemotion
  };
}


async function main() {
  console.log('Starting main script...');
  const args = process.argv.slice(2);
  if (args.length < 4) {
    console.error('Usage: main.ts <audioFile> <outputVideo> <stewieImage> <peterImage> [backgroundVideo]');
    process.exit(1);
  }
  const [
    audioFile,
    outputVideo = 'out/video.mp4',
    stewieImage,
    peterImage,
    backgroundVideo,
  ] = args;
  console.log('Arguments received:', { audioFile, outputVideo, stewieImage, peterImage, backgroundVideo });

  const { audioUploadPath, stewieUploadPath, peterUploadPath, bgUploadPath, audioFileForRemotion, stewieImageForRemotion, peterImageForRemotion, backgroundVideoForRemotion } = await moveFilesToUploads(audioFile, stewieImage, peterImage, backgroundVideo);
  // Install whisper.cpp and download the model
  console.log('Installing whisper.cpp...');
  await installWhisperCpp({ to: WHISPER_PATH, version: WHISPER_VERSION });
  console.log('Downloading whisper model...');
  await downloadWhisperModel({ folder: WHISPER_PATH, model: WHISPER_MODEL });

  let tempDir;
  // Use the copied audio file for whisper transcription
  console.log(`Using audio file for transcription: ${audioUploadPath}`);

  // Ensure audio is 16kHz WAV for whisper
  let inputForWhisper = audioUploadPath;
  if (!audioUploadPath.toLowerCase().endsWith('.wav')) {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transcribe-'));    
    const convertedWav = path.join(tempDir, path.basename(audioUploadPath, path.extname(audioUploadPath)) + '.wav');
    console.log(`Converting ${audioUploadPath} to 16KHz WAV: ${convertedWav}`);
    const conversion = spawnSync(
      'npx',
      ['remotion', 'ffmpeg', '-i', audioUploadPath, '-ar', '16000', convertedWav, '-y'],
      { stdio: 'inherit' }
    );
    if (conversion.error) {
      console.error('Error converting audio file:', conversion.error);
      process.exit(1);
    }
    if (conversion.status !== 0) {
      console.error(`FFmpeg conversion failed with exit code ${conversion.status}`);
      process.exit(1);
    }
    inputForWhisper = convertedWav;
  }

  // Transcribe audio
  console.log(`Transcribing ${inputForWhisper}`);
  const whisperOutput = await transcribe({
    inputPath: inputForWhisper,
    model: WHISPER_MODEL,
    tokenLevelTimestamps: true,
    whisperPath: WHISPER_PATH,
    whisperCppVersion: WHISPER_VERSION,
    printOutput: false,
    translateToEnglish: false,
    language: WHISPER_LANG,
    splitOnWord: true,
  });
  console.log('Transcription complete.');
  // console.log(`whisperOutput: ${JSON.stringify(whisperOutput.transcription)}`);
  // console.log(`whisperOutput: ${JSON.stringify(whisperOutput)["result"]["transcription"]}`);
  const { captions } = toCaptions({ whisperCppOutput: whisperOutput });
  console.log('Captions generated.');
  // Preprocess segments around END_WORD in captions using a simple loop
  const END_WORD = 'fart';
  const segments = [];
  let segmentStart = 0;
  const videoEndMs = captions[captions.length - 1]?.endMs ?? 0;
  for (let i = 0; i < captions.length; i++) {
    if (captions[i].text.toLowerCase() === END_WORD) {
      const prevEnd = captions[i - 1]?.endMs ?? 0;
      segments.push({ startMs: segmentStart, endMs: prevEnd });
      segmentStart = captions[i + 1]?.startMs ?? captions[i]?.endMs ?? prevEnd;
    }
  }
  // Push final segment
  segments.push({ startMs: segmentStart, endMs: videoEndMs });
  // Fart captions - use the relative paths for Remotion staticFile API
  const props = { 
    src: audioFileForRemotion, 
    captions, 
    segments, 
    stewieImage: stewieImageForRemotion, 
    peterImage: peterImageForRemotion, 
    backgroundVideo: backgroundVideoForRemotion 
  };
  console.log('Prepared props for Remotion.');

  // Render video using remotion CLI
  console.log(`Rendering video to ${outputVideo}...`);
  const result = spawnSync(
    'npx',
    ['remotion', 'render', 'remotion_src/index.ts', 'CaptionedVideo', outputVideo, '--props', JSON.stringify(props)],
    { stdio: 'inherit' },
  );
  if (result.error) {
    console.error('Error during rendering:', result.error);
    process.exit(1);
  }
  console.log('Video rendering finished.');

  // Clean up temporary whisper files
  if (inputForWhisper !== audioUploadPath && tempDir) {
    try {
      fs.unlinkSync(inputForWhisper);
      fs.rmdirSync(tempDir);
      console.log(`Cleaned up temporary files in ${tempDir}`);
    } catch (err) {
      console.warn(`Failed to clean up temporary files: ${err}`);
    }
  }

  // Clean up files from uploads folder
  console.log('Cleaning up uploads folder...');
  try {
    fs.unlinkSync(audioUploadPath);
    fs.unlinkSync(stewieUploadPath);
    fs.unlinkSync(peterUploadPath);
    fs.unlinkSync(bgUploadPath);
    console.log('All upload files cleaned up successfully');
  } catch (err) {
    console.warn(`Failed to clean up upload files: ${err}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
console.log('Main script finished.'); 