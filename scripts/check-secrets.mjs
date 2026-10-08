import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const staged = process.argv.includes('--staged');
const files = execFileSync('git', staged ? ['diff','--cached','--name-only','-z'] : ['ls-files','-z']).toString().split('\0').filter(Boolean);
let configuredKey = '';
try { configuredKey = readFileSync('.env','utf8').match(/^DEEPSEEK_API_KEY=(.*)$/m)?.[1]?.trim() || ''; } catch {}
for (const file of files) {
  if (file !== '.env.example' && (/(^|\/)\.env($|\.)/.test(file) || /^(data|artifacts|\.hosting|dist|node_modules)\//.test(file) || /(^|\/)\.dev\.vars/.test(file))) throw new Error('Private deployment or runtime file is tracked: '+file);
  const bytes = execFileSync('git',['show',(staged ? ':' : 'HEAD:')+file],{maxBuffer:10000000});
  if (configuredKey && bytes.includes(Buffer.from(configuredKey)) || /sk-[A-Za-z0-9]{24,}|gh[pousr]_[A-Za-z0-9]{30,}/.test(bytes.toString('utf8'))) throw new Error('Possible credential in '+file+'. Publication blocked.');
}
console.log(JSON.stringify({checkedFiles:files.length,secretsFound:0,privateFilesExcluded:true}));
