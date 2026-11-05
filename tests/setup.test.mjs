import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,writeFileSync,readFileSync,existsSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join,basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import { inspect,archiveNested } from '../scripts/workspace.mjs';
const git=(root,...args)=>execFileSync('git',['-C',root,...args],{stdio:'pipe'});
function fixture() {
 const dir=mkdtempSync(join(tmpdir(),'coach-setup-'));
 git(dir,'init');git(dir,'config','user.email','test@example.invalid');git(dir,'config','user.name','Test');
 git(dir,'remote','add','origin','https://github.com/example/coach.git');
 writeFileSync(join(dir,'package.json'),'{}');git(dir,'add','.');git(dir,'commit','-m','fixture');
 return dir;
}
test('diagnostics report variable names, not values, and do not change files',()=>{
 const root=fixture();try{
  writeFileSync(join(root,'.env.local'),'NEXT_PUBLIC_SUPABASE_URL=https://test.invalid\n');
  const info=inspect(root);assert.equal(info.envExists,true);assert.ok(info.configuredNames.includes('NEXT_PUBLIC_SUPABASE_URL'));
  assert.equal(archiveNested(root),null);
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('nested cleanup preserves .env, untracked files, local edits and Git metadata',()=>{
 const root=fixture();let backup;
 try{
  const nested=join(root,basename(root));
  execFileSync('git',['clone',root,nested],{stdio:'pipe'});git(nested,'remote','set-url','origin','https://github.com/example/coach.git');
  writeFileSync(join(nested,'.env.local'),'LOCAL_TEST_VALUE=must-survive');writeFileSync(join(nested,'scratch.txt'),'untracked');writeFileSync(join(nested,'package.json'),'{"local":true}');
  assert.equal(inspect(root).safeNested,true);backup=archiveNested(root);
  assert.equal(existsSync(nested),false);assert.equal(readFileSync(join(backup,'.env.local'),'utf8'),'LOCAL_TEST_VALUE=must-survive');
  assert.equal(readFileSync(join(backup,'scratch.txt'),'utf8'),'untracked');assert.equal(readFileSync(join(backup,'package.json'),'utf8'),'{"local":true}');assert.ok(existsSync(join(backup,'.git')));
 }finally{rmSync(root,{recursive:true,force:true});if(backup)rmSync(backup,{recursive:true,force:true});}
});
test('different nested repository is never moved',()=>{
 const root=fixture();try{
  const nested=join(root,basename(root));execFileSync('git',['clone',root,nested],{stdio:'pipe'});git(nested,'remote','set-url','origin','https://github.com/example/other.git');
  assert.throws(()=>archiveNested(root),/could not be verified/);assert.ok(existsSync(nested));
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('nested local-only commits remain recoverable after archive',()=>{
 const root=fixture();let backup;
 try{
  const nested=join(root,basename(root));execFileSync('git',['clone',root,nested],{stdio:'pipe'});git(nested,'remote','set-url','origin','https://github.com/example/coach.git');
  git(nested,'config','user.email','test@example.invalid');git(nested,'config','user.name','Test');writeFileSync(join(nested,'local-only.txt'),'keep commit');git(nested,'add','.');git(nested,'commit','-m','local-only');
  const head=git(nested,'rev-parse','HEAD').toString();backup=archiveNested(root);assert.equal(git(backup,'rev-parse','HEAD').toString(),head);assert.equal(readFileSync(join(backup,'local-only.txt'),'utf8'),'keep commit');
 }finally{rmSync(root,{recursive:true,force:true});if(backup)rmSync(backup,{recursive:true,force:true});}
});
