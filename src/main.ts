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

async function main() {
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

  // Install whisper.cpp and download the model
  await installWhisperCpp({ to: WHISPER_PATH, version: WHISPER_VERSION });
  await downloadWhisperModel({ folder: WHISPER_PATH, model: WHISPER_MODEL });

  let tempDir;
  // Ensure audio is 16kHz WAV for whisper
  let inputForWhisper = audioFile;
  if (!audioFile.toLowerCase().endsWith('.wav')) {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transcribe-'));    
    const convertedWav = path.join(tempDir, path.basename(audioFile, path.extname(audioFile)) + '.wav');
    console.log(`Converting ${audioFile} to 16KHz WAV: ${convertedWav}`);
    const conversion = spawnSync(
      'npx',
      ['remotion', 'ffmpeg', '-i', audioFile, '-ar', '16000', convertedWav, '-y'],
      { stdio: 'inherit' }
    );
    if (conversion.error) {
      console.error('Error converting audio file:', conversion.error);
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
  console.log(`whisperOutput: ${JSON.stringify(whisperOutput.transcription)}`);
  // console.log(`whisperOutput: ${JSON.stringify(whisperOutput)["result"]["transcription"]}`);
  const { captions } = toCaptions({ whisperCppOutput: whisperOutput });
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
  // Fart captions
  const fartCaptions = captions.filter((c) => c.text.toLowerCase() === END_WORD);
  const props = { src: audioFile, captions, segments, fartCaptions };

  // Render video using remotion CLI
  console.log(`Rendering video to ${outputVideo}`);
  const result = spawnSync(
    'npx',
    ['remotion', 'render', 'remotion_src/index.ts', 'CaptionedVideo', outputVideo, '--props', JSON.stringify(props)],
    { stdio: 'inherit' },
  );
  if (result.error) {
    console.error('Error during rendering:', result.error);
    process.exit(1);
  }

  if (inputForWhisper !== audioFile) {
    try {
      fs.unlinkSync(inputForWhisper);
      fs.rmdirSync(tempDir);
      console.log(`Cleaned up temporary files in ${tempDir}`);
    } catch (err) {
      console.warn(`Failed to clean up temporary files: ${err}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
}); 