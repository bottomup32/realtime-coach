import { existsSync, readFileSync, realpathSync, renameSync, statSync } from 'node:fs';
import { resolve, basename, dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const required = ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','GOOGLE_GENERATIVE_AI_API_KEY','GEMINI_LIVE_MODEL','GEMINI_COACH_MODEL'];
const git = (root, ...args) => execFileSync('git', ['-C',root,...args], {encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
export function inspect(root) {
  root = realpathSync(root);
  if (realpathSync(git(root,'rev-parse','--show-toplevel')) !== root) throw new Error('Run this command at the repository root.');
  const nested = join(root,basename(root));
  const env = join(root,'.env.local');
  const names = new Set();
  if (existsSync(env)) for (const line of readFileSync(env,'utf8').split(/\r?\n/)) {
    const match=line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if(match && match[2].trim() && !['""',"''"].includes(match[2].trim())) names.add(match[1]);
  }
  let safeNested = false;
  if (existsSync(join(nested,'.git')) && existsSync(join(nested,'package.json'))) {
    // Linked worktrees/submodules are deliberately excluded from automatic moves.
    const meta = join(nested,'.git');
    try {
      const outerOrigin=git(root,'remote','get-url','origin');
      const innerOrigin=git(nested,'remote','get-url','origin');
      const normalize=s=>s.replace(/\.git$/,'').replace(/\/$/,'');
      safeNested = statSync(meta).isDirectory() && realpathSync(meta) === meta && realpathSync(nested) === nested
        && normalize(outerOrigin) === normalize(innerOrigin)
        && !git(root,'ls-files','--',basename(root));
    } catch { safeNested = false; }
  }
  return { root,nested,nestedExists:existsSync(nested),safeNested,envExists:existsSync(env),configuredNames:required.filter(n=>names.has(n)||!!process.env[n]),missingNames:required.filter(n=>!names.has(n)&&!process.env[n]) };
}
export function archiveNested(root) {
  const info=inspect(root);
  if(!info.nestedExists) return null;
  if(!info.safeNested) throw new Error('Nested folder could not be verified as a duplicate checkout with the same origin. No files moved.');
  const target=join(dirname(info.root),`${basename(info.root)}-nested-backup-${Date.now()}`);
  if(existsSync(target)) throw new Error('Backup path already exists. No files moved.');
  // Move the complete checkout, including ignored .env files, .git, and local edits.
  renameSync(info.nested,target);
  return target;
}
if(process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const root=resolve(process.argv.find(a=>a.startsWith('--root='))?.slice(7)||process.cwd());
    const info=inspect(root);
    console.log(JSON.stringify({workingDirectory:info.root,envFile:join(info.root,'.env.local'),envFileExists:info.envExists,configuredNames:info.configuredNames,missingNames:info.missingNames,nestedFolderExists:info.nestedExists,safeToArchive:info.safeNested},null,2));
    if(process.argv.includes('--apply')) {
      const backup=archiveNested(root);
      console.log(backup?`Nested checkout preserved at: ${backup}`:'No nested checkout; no files moved.');
    } else if(info.nestedExists) console.log('Preview only. Stop both dev servers, then run npm run repo:tidy -- --apply to preserve the entire duplicate in a sibling backup folder.');
  } catch(error) { console.error(error.message);process.exitCode=1; }
}
