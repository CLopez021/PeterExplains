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
import { createSegments } from './SegmentCreator';
import { getImages, type ImageSearchResult } from './ImageSearch';

const VERBOSE = process.env.VERBOSE === 'true';

// Utility function for verbose logging
const log = (...args: unknown[]) => {
  if (VERBOSE) {
    console.log(...args);
  }
};

async function moveFilesToUploads(audioFile: string, stewieImage: string, peterImage: string, backgroundVideo: string) {
  const publicDir = path.join(process.cwd(), 'public');
  const uploadsDir = path.join(publicDir, 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  log('Preparing files for Remotion staticFile API...');
  const timestamp = Date.now();

  function processFile(inputPath: string, prefix: string) {
    const absInput = path.isAbsolute(inputPath)
      ? inputPath
      : path.join(process.cwd(), inputPath);
    if (absInput.startsWith(publicDir + path.sep)) {
      const relPath = path
        .relative(publicDir, absInput)
        .split(path.sep)
        .join('/');
      log(`${prefix} already in public directory, using ${relPath}`);
      return { uploadPath: absInput, fileForRemotion: relPath, wasCopied: false };
    } else {
      const ext = path.extname(inputPath);
      const fileName = `${prefix}_${timestamp}${ext}`;
      const dst = path.join(uploadsDir, fileName);
      fs.copyFileSync(absInput, dst);
      log(`${prefix} copied: ${absInput} -> uploads/${fileName}`);
      return { uploadPath: dst, fileForRemotion: `uploads/${fileName}`, wasCopied: true };
    }
  }

  const { uploadPath: audioUploadPath, fileForRemotion: audioFileForRemotion, wasCopied: audioWasCopied } =
    processFile(audioFile, 'Audio');
  const { uploadPath: stewieUploadPath, fileForRemotion: stewieImageForRemotion, wasCopied: stewieWasCopied } =
    processFile(stewieImage, 'Stewie image');
  const { uploadPath: peterUploadPath, fileForRemotion: peterImageForRemotion, wasCopied: peterWasCopied } =
    processFile(peterImage, 'Peter image');
  const { uploadPath: bgUploadPath, fileForRemotion: backgroundVideoForRemotion, wasCopied: bgWasCopied } =
    backgroundVideo
      ? processFile(backgroundVideo, 'Background video')
      : { uploadPath: '', fileForRemotion: '', wasCopied: false };

  return {
    audioUploadPath,
    stewieUploadPath,
    peterUploadPath,
    bgUploadPath,
    audioFileForRemotion,
    stewieImageForRemotion,
    peterImageForRemotion,
    backgroundVideoForRemotion,
    audioWasCopied,
    stewieWasCopied,
    peterWasCopied,
    bgWasCopied,
  };
}


async function main() {
  log('Starting main script...');
  const args = process.argv.slice(2);
  if (args.length < 5) {
    console.error('Usage: main.ts <audioFile> <outputVideo> <stewieImage> <peterImage> [backgroundVideo] [segmentDefsJson] [enableImageSearch]');
    process.exit(1);
  }
  const [
    audioFile,
    outputVideo = 'out/video.mp4',
    stewieImage,
    peterImage,
    backgroundVideo,
    segmentDefsJson,
    enableImageSearchArg,
  ] = args;
  
  // Parse the enableImageSearch parameter
  const enableImageSearch = enableImageSearchArg === 'true';
  log('Arguments received:', { audioFile, outputVideo, stewieImage, peterImage, backgroundVideo, segmentDefsJson, enableImageSearch });

  const { audioUploadPath, stewieUploadPath, peterUploadPath, bgUploadPath, audioFileForRemotion, stewieImageForRemotion, peterImageForRemotion, backgroundVideoForRemotion, audioWasCopied, stewieWasCopied, peterWasCopied, bgWasCopied } = await moveFilesToUploads(audioFile, stewieImage, peterImage, backgroundVideo);
  
  // Install whisper.cpp and download the model
  log('Installing whisper.cpp...');
  await installWhisperCpp({ to: WHISPER_PATH, version: WHISPER_VERSION });
  log('Downloading whisper model...');
  await downloadWhisperModel({ folder: WHISPER_PATH, model: WHISPER_MODEL });

  let tempDir;
  // Use the copied audio file for whisper transcription
  log(`Using audio file for transcription: ${audioUploadPath}`);

  // Ensure audio is 16kHz WAV for whisper
  let inputForWhisper = audioUploadPath;
  if (!audioUploadPath.toLowerCase().endsWith('.wav')) {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transcribe-'));    
    const convertedWav = path.join(tempDir, path.basename(audioUploadPath, path.extname(audioUploadPath)) + '.wav');
    log(`Converting ${audioUploadPath} to 16KHz WAV: ${convertedWav}`);
    const conversion = spawnSync(
      'npx',
      ['remotion', 'ffmpeg', '-i', audioUploadPath, '-ar', '16000', convertedWav, '-y'],
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
  log(`Transcribing ${inputForWhisper}`);
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
  log('Transcription complete.');
  const { captions } = toCaptions({ whisperCppOutput: whisperOutput });
  
  // Create segments using JSON definitions and fallback logic
  let segmentDefs: { speaker: string; text: string }[] = [];
  if (typeof segmentDefsJson === 'string') {
    try {
      segmentDefs = JSON.parse(segmentDefsJson);
    } catch (err) {
      console.error('Invalid segments JSON:', err);
      process.exit(1);
    }
  }
  const segments = createSegments(captions, segmentDefs);
  
  // Extract transcript for image search (if enabled)
  let imageSearchResults: ImageSearchResult[] = [];
  if (enableImageSearch) {
    try {
      log('Extracting transcript for image search...');
      // Create a transcript string with millisecond timestamps
      const transcript = captions
        .map(caption => `${caption.startMs}ms ${caption.text}`)
        .join(' ');
      
      log('Searching for images...');
      imageSearchResults = await getImages(transcript);
      log('Image search completed. Found', imageSearchResults.length, 'image results.');
    } catch (err) {
      console.warn('Image search failed, continuing without images:', err instanceof Error ? err.message : String(err));
      imageSearchResults = [];
    }
  } else {
    log('Image search disabled, skipping...');
    imageSearchResults = [];
  }
  
  log('Image search results:', imageSearchResults);
  
  // Prepare props for Remotion staticFile API
  const props = { 
    src: audioFileForRemotion, 
    captions, 
    segments, 
    stewieImage: stewieImageForRemotion, 
    peterImage: peterImageForRemotion, 
    backgroundVideo: backgroundVideoForRemotion, 
    images: imageSearchResults, 
  };

  // Render video using remotion CLI
  console.log('🎬 Rendering video...');
  const result = spawnSync(
    'npx',
    ['remotion', 'render', 'remotion_src/index.ts', 'CaptionedVideo', outputVideo, '--props', JSON.stringify(props)],
    { stdio: 'inherit' },
  );
  if (result.error) {
    console.error('Error during rendering:', result.error);
    process.exit(1);
  }
  console.log('✅ Video rendering finished.');

  // Clean up temporary whisper files
  if (inputForWhisper !== audioUploadPath && tempDir) {
    try {
      fs.unlinkSync(inputForWhisper);
      fs.rmdirSync(tempDir);
      log(`Cleaned up temporary files in ${tempDir}`);
    } catch (err) {
      console.warn(`Failed to clean up temporary files: ${err}`);
    }
  }

  // Clean up files from uploads folder (only files that were actually copied)
  log('Cleaning up copied files...');
  const filesToCleanup = [
    { path: audioUploadPath, wasCopied: audioWasCopied },
    { path: stewieUploadPath, wasCopied: stewieWasCopied },
    { path: peterUploadPath, wasCopied: peterWasCopied },
    { path: bgUploadPath, wasCopied: bgWasCopied }
  ].filter(file => file.path && file.wasCopied);
  
  if (filesToCleanup.length) {
    log('Cleaning up copied upload files...');
    filesToCleanup.forEach(file => {
      try {
        fs.unlinkSync(file.path);
        log(`Deleted ${file.path}`);
      } catch (err) {
        console.warn(`Failed to delete ${file.path}: ${err}`);
      }
    });
  } else {
    log('No copied upload files to clean up');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
}); 