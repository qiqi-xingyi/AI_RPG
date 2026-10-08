import { cp, mkdir } from 'node:fs/promises';
const target='.hosting/site';
await mkdir(target,{recursive:true});
for (const file of ['cloud','db','drizzle','lib','public','scripts','test','package.json','server.mjs','package-lock.json','drizzle.config.ts','LICENSE','README.md','README.en.md','CONTRIBUTING.md','docs','.gitignore','.env.example']) await cp(file,`${target}/${file}`,{recursive:true});
console.log('Sanitized Site source prepared. Credentials and player saves excluded.');
