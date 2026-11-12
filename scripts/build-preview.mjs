import {spawnSync} from 'node:child_process';
// Load the same public configuration into both the gate and EAS child process.
try {process.loadEnvFile('.env');} catch(error) {if(error.code!=='ENOENT') throw error;}
if(process.argv.slice(2).some(arg=>arg!=='--local')) throw new Error('지원 옵션: --local');
const profile=process.argv.includes('--local') ? 'preview-local' : 'preview';
process.env.EAS_BUILD_PROFILE=profile;
const check=spawnSync(process.execPath,['scripts/check-deployment.mjs'],{stdio:'inherit',env:process.env});
if(check.status!==0) process.exit(check.status ?? 1);
// Explicit executable/arguments; no interpolated shell credentials or build command.
const command=process.platform==='win32' ? 'pnpm.cmd' : 'pnpm';
const result=spawnSync(command,['dlx','eas-cli@latest','build','--platform','android','--profile',profile],
  {stdio:'inherit',env:process.env,shell:process.platform==='win32'});
process.exit(result.status ?? 1);
