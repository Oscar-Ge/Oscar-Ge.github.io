// Unattended production updater: no browser, session or database credential.
// The public API accepts only due months based on its own clock.
import {mkdir,writeFile} from 'node:fs/promises';
import {API_ORIGIN} from '../config.mjs';
const call=async(path,method='GET')=>{
 for(let attempt=0;attempt<3;attempt++){
  try{const r=await fetch(API_ORIGIN+path,{method,headers:{'Content-Type':'application/json'},...(method==='POST'?{body:'{}'}:{}),signal:AbortSignal.timeout(30000)});const d=await r.json();if(!r.ok)throw new Error(`${r.status}: ${d.error||'request failed'}`);return d;}
  catch(e){if(attempt===2)throw e;await new Promise(resolve=>setTimeout(resolve,1000*2**attempt));}
 }
};
const before=await call('/api/rent');
const result=await call('/api/rent','POST');
const after=await call('/api/rent');
if(after.dueMonths.length)throw new Error('Due rent remains after the update.');
const month=after.localDate.slice(0,7),entry=after.generatedMonths.find(e=>e.month===month);
// A manually recorded matching rent also satisfies the idempotency rule.
const data=await call('/api/books/d6');
const matching=data.book.entries.filter(e=>e.kind==='expense'&&e.date.startsWith(month)&&e.amountCents===212500&&(e.id===`rent-${month}`||e.category==='rent'||/rent|房租/i.test(e.description)));
const due=after.rule?.enabled&&month>=after.rule.startMonth;
if(due&&!entry&&!matching.length)throw new Error('The due rent entry could not be read back.');
const receipt={schemaVersion:1,checkedAt:new Date().toISOString(),localDate:after.localDate,timezone:after.timezone,bookId:'d6',month,ruleEnabled:after.rule?.enabled??false,startMonth:after.rule?.startMonth,amountCents:212500,addedMonths:result.addedMonths,revisionBefore:before.revision,revisionAfter:after.revision,monthlyEntryFound:matching.length>0,monthlyEntryDeleted:matching.some(e=>!!e.deletedAt),status:!after.rule?.enabled?'paused':!due?'not_due_yet':matching.some(e=>!!e.deletedAt)?'deleted_by_user':'verified',runId:process.env.GITHUB_RUN_ID||null};
const file=new URL('../data/rent-status.json',import.meta.url);await mkdir(new URL('../data/',import.meta.url),{recursive:true});await writeFile(file,JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt,null,2));
