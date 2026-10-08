import fs from 'node:fs/promises';
const origin='https://finances-preprod.jolurie.com';
const report={checkedAt:new Date().toISOString(), origin, checks:[]};
for(const [name,url,headers] of [
 ['frontend',origin+'/',{}],['unauthenticated-api',origin+'/api/accounts',{}],
 ['invalid-token-api',origin+'/api/accounts',{Authorization:'Bearer invalid'}],
 ['silent-sso',origin+'/silent-check-sso.html',{}],['public-auth-config',origin+'/api/auth/config',{}],
 ['oidc','https://auth.jolurie.com/realms/suivi-cb-preprod/.well-known/openid-configuration',{}],
 ['http-redirect','http://finances-preprod.jolurie.com/',{}]]) {
 try {const response=await fetch(url,{headers,redirect:'manual',signal:AbortSignal.timeout(15000)});
 const selected=Object.fromEntries([...response.headers].filter(([k])=>['strict-transport-security','content-security-policy','content-security-policy-report-only','x-frame-options','x-content-type-options','referrer-policy','permissions-policy','cache-control','www-authenticate','location','content-type'].includes(k)));
 const check={name,status:response.status,headers:selected};
 if(name==='public-auth-config'){const data=await response.json();check.configuration={url:data.url,realm:data.realm,clientId:data.clientId};}
 if(name==='oidc'){const data=await response.json();check.issuer=data.issuer;}
 report.checks.push(check);
 } catch(error){report.checks.push({name,error:String(error.code||error.cause?.code||error.name), detail:error.message});}
}
await fs.writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
