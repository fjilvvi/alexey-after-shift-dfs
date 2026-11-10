// Fallback for environments where the Sites source helper is not installed.
// Repository credential is accepted on hidden stdin only; never persisted.
import { spawnSync } from 'node:child_process';
import readline from 'node:readline';
const rl=readline.createInterface({input:process.stdin});
console.log('Ready for repository credential JSON on stdin (input hidden).');
rl.once('line',line=>{
 rl.close();
 const c=JSON.parse(line);
 const env={...process.env};
 if(c.token){env.GIT_CONFIG_COUNT='1';env.GIT_CONFIG_KEY_0='http.extraHeader';env.GIT_CONFIG_VALUE_0='Authorization: Bearer '+c.token;}
 function run(args,opts={}){const r=spawnSync('git',args,{encoding:'utf8',env,...opts});if(r.status!==0){console.error(r.stderr);process.exit(r.status||1);}return r.stdout.trim();}
 if(process.argv.includes('--probe')){run(['ls-remote',c.remote_url]);console.log('Repository authentication verified.');process.exit(0);}
 if(!spawnSync('git',['rev-parse','--is-inside-work-tree']).status){}else run(['init','-b',c.branch]);
 run(['config','user.name','DFS Arcade']);run(['config','user.email','arcade@dfs.local']);
 run(['add','.']);const changes=run(['status','--porcelain']);if(changes)run(['commit','-m','Build Alexey After Shift arcade game']);
 const hasRemote=spawnSync('git',['remote','get-url','origin'],{encoding:'utf8'}).status===0;
 run(hasRemote?['remote','set-url','origin',c.remote_url]:['remote','add','origin',c.remote_url]);
 run(['push','-u','origin',c.branch]);
 const sha=run(['rev-parse','HEAD']);const remoteSha=run(['ls-remote','origin','refs/heads/'+c.branch]).split(/\s/)[0];
 if(sha!==remoteSha)throw new Error('Remote commit does not match local build');
 console.log(JSON.stringify({commit_sha:sha,remote_verified:true}));
});
