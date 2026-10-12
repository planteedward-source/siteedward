import ffmpeg from 'ffmpeg-static';
import { spawnSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const [source,name] = process.argv.slice(2);
if (!source || !/^reference-u13-aaa-[1-3]$/.test(name || '')) throw new Error('Usage: node scripts/import-video.mjs source.mov reference-u13-aaa-1');
const destination=resolve('public/videos');await mkdir(destination,{recursive:true});
const video=resolve(destination,`${name}.mp4`);const poster=resolve(destination,`${name}.jpg`);
for (const args of [
  ['-i',resolve(source),'-map','0:v:0','-an','-map_metadata','-1','-map_chapters','-1','-vf','scale=w=min(1280\\,iw):h=min(1280\\,ih):force_original_aspect_ratio=decrease:force_divisible_by=2','-r','30','-c:v','libx264','-preset','medium','-crf','23','-pix_fmt','yuv420p','-threads','2','-movflags','+faststart',video],
  ['-ss','0.8','-i',video,'-frames:v','1','-vf','scale=640:-2','-q:v','3',poster],
]) {const result=spawnSync(ffmpeg,['-hide_banner','-loglevel','error','-y',...args],{stdio:'inherit'});if(result.status !== 0) throw new Error('Video conversion failed');}
console.log(`${name}: MP4 and poster ready.`);
