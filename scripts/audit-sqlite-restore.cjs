const fs=require('node:fs');
const sqlite3=require('/app/node_modules/sqlite3');
const open=file=>new Promise((resolve,reject)=>{const db=new sqlite3.Database(file,sqlite3.OPEN_READONLY,error=>error?reject(error):resolve(db));});
const all=(db,sql,args=[])=>new Promise((resolve,reject)=>db.all(sql,args,(error,rows)=>error?reject(error):resolve(rows)));
const close=db=>new Promise((resolve,reject)=>db.close(error=>error?reject(error):resolve()));
async function check(file){const db=await open(file);try{
 const integrity=await all(db,'PRAGMA integrity_check');if(integrity.length!==1||integrity[0].integrity_check!=='ok')throw new Error('Integrity check failed');
 const foreignKeys=await all(db,'PRAGMA foreign_key_check');if(foreignKeys.length)throw new Error('Foreign key check failed');
 const tables=await all(db,"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
 const counts={};for(const {name} of tables){const escaped=name.replace(/"/g,'""');counts[name]=(await all(db,'SELECT COUNT(*) AS n FROM "'+escaped+'"'))[0].n;}
 return counts;
}finally{await close(db)}}
(async()=>{process.umask(0o077);const original=await open('/source/database.db');try{await all(original,"VACUUM INTO '/audit/snapshot.db'");}finally{await close(original)}
 fs.copyFileSync('/audit/snapshot.db','/audit/restored.db',fs.constants.COPYFILE_EXCL);
 const snapshot=await check('/audit/snapshot.db');const restored=await check('/audit/restored.db');
 if(JSON.stringify(snapshot)!==JSON.stringify(restored))throw new Error('Row counts mismatch');
 fs.chmodSync('/audit/snapshot.db',0o600);fs.chmodSync('/audit/restored.db',0o600);
 console.log(JSON.stringify({checkedAt:new Date().toISOString(),integrity:'ok',foreignKeys:'ok',restoration:'ok',rowCounts:restored},null,2));
})().catch(()=>{console.error('SQLite restoration check failed; keep the isolated files for diagnosis.');process.exitCode=1;});
