import {validateSource,sourceFitsEntry} from './finance.mjs';
import {validateFx,originalText} from './currency.mjs';
import {validateAttachment,MAX_ATTACHMENTS} from './attachments.mjs';
// Amounts are integer cents. Shares retain microcent precision so imported
// Kittysplit fractions do not accumulate rounding differences.
export const SCALE=1_000_000;
export const MAX_AMOUNT=100_000_000;
export const CATEGORIES={other:'其他',groceries:'日常采购',food:'餐饮',rent:'房租',utilities:'水电网络',transport:'交通',travel:'旅行',shopping:'购物',transfer:'还款'};
export function uid(){if(typeof crypto.randomUUID==='function')return crypto.randomUUID();const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=[...b].map(n=>n.toString(16).padStart(2,'0')).join('');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;}
export function cents(text){
 const s=String(text).trim();
 if(!/^\d+(\.\d{1,2})?$/.test(s))throw new Error('金额请输入正数，最多保留两位小数。');
 const [whole,frac='']=s.split('.');const n=Number(whole)*100+Number(frac.padEnd(2,'0'));
 if(!Number.isSafeInteger(n)||n<=0||n>MAX_AMOUNT)throw new Error('金额须大于 0，且不超过 $1,000,000。');
 return n;
}
export function distribute(total,weights){
 if(!Number.isSafeInteger(total)||total<0)throw new Error('分摊总额无效。');
 const pairs=Object.entries(weights).filter(([,v])=>Number(v)>0);
 if(!pairs.length||pairs.some(([,v])=>!Number.isFinite(Number(v))))throw new Error('请至少选择一位参与人。');
 const ints=pairs.map(([id,v])=>[id,BigInt(Math.round(Number(v)*1_000_000))]);
 const sum=ints.reduce((a,[,v])=>a+v,0n);if(sum<=0n)throw new Error('分摊份数须大于 0。');
 const T=BigInt(total);const parts=ints.map(([id,v],i)=>({id,i,n:T*v/sum,r:T*v%sum}));
 let remainder=T-parts.reduce((a,p)=>a+p.n,0n);
 const ordered=[...parts].sort((a,b)=>a.r===b.r?a.i-b.i:(a.r>b.r?-1:1));
 for(let i=0;remainder>0n;i++,remainder--)ordered[i%ordered.length].n++;
 return Object.fromEntries(parts.map(p=>[p.id,Number(p.n)]));
}
export function splitAmount(amountCents,mode,values){
 const selected=Object.fromEntries(Object.entries(values).filter(([,v])=>v!==''&&v!==null&&v!==false));
 if(!Object.keys(selected).length)throw new Error('请至少选择一位参与人。');
 if(mode==='equal')return distribute(amountCents*SCALE,Object.fromEntries(Object.keys(selected).map(id=>[id,1])));
 if(mode==='amount'){
  const result=Object.fromEntries(Object.entries(selected).map(([id,v])=>[id,/^0(?:\.0{1,2})?$/.test(String(v).trim())?0:cents(v)*SCALE]));
  if(Object.values(result).reduce((a,b)=>a+b,0)!==amountCents*SCALE)throw new Error('各人的分摊金额之和必须等于账单金额。');return result;
 }
 const weights=Object.fromEntries(Object.entries(selected).map(([id,v])=>[id,Number(v)]));
 if(Object.values(weights).some(n=>!Number.isFinite(n)||n<0||n>1e6))throw new Error('分摊数值须为有效的非负数。');
 if(mode==='percent'&&Math.abs(Object.values(weights).reduce((a,b)=>a+b,0)-100)>0.000001)throw new Error('百分比之和必须为 100%。');
 return distribute(amountCents*SCALE,weights);
}
export function summarize(book){
 const stats=Object.fromEntries(book.members.map(m=>[m.id,{id:m.id,name:m.name,balanceUnits:0,shareUnits:0,paidCents:0,incomeCents:0,sentCents:0,receivedCents:0}]));
 let expenseCents=0,incomeCents=0,expenseCount=0,transferCount=0,incomeCount=0;
 for(const e of book.entries){
  if(e.deletedAt)continue;const p=stats[e.payerId];
  if(e.kind==='transfer'){transferCount++;p.sentCents+=e.amountCents;p.balanceUnits+=e.amountCents*SCALE;stats[e.payeeId].receivedCents+=e.amountCents;stats[e.payeeId].balanceUnits-=e.amountCents*SCALE;}
  else{const sign=e.kind==='income'?-1:1;
   if(sign===1){expenseCents+=e.amountCents;expenseCount++;p.paidCents+=e.amountCents;}else{incomeCents+=e.amountCents;incomeCount++;p.incomeCents+=e.amountCents;}
   p.balanceUnits+=sign*e.amountCents*SCALE;for(const [id,u] of Object.entries(e.shares)){stats[id].shareUnits+=sign*u;stats[id].balanceUnits-=sign*u;}
  }
 }
 const people=Object.values(stats);for(const p of people)p.balanceCents=Math.round(p.balanceUnits/SCALE)||0;
 let drift=people.reduce((a,p)=>a+p.balanceCents,0);
 while(drift!==0){const dir=drift>0?-1:1;const sorted=[...people].sort((a,b)=>dir*((b.balanceUnits/SCALE-b.balanceCents)-(a.balanceUnits/SCALE-a.balanceCents)));sorted[0].balanceCents+=dir;drift+=dir;}
 const debtors=people.filter(p=>p.balanceCents<0).map(p=>({id:p.id,left:-p.balanceCents})).sort((a,b)=>b.left-a.left);
 const creditors=people.filter(p=>p.balanceCents>0).map(p=>({id:p.id,left:p.balanceCents})).sort((a,b)=>b.left-a.left);
 const settlements=[];let i=0,j=0;const outstandingCents=creditors.reduce((a,p)=>a+p.left,0);
 while(i<debtors.length&&j<creditors.length){const amountCents=Math.min(debtors[i].left,creditors[j].left);settlements.push({payerId:debtors[i].id,payeeId:creditors[j].id,amountCents});debtors[i].left-=amountCents;creditors[j].left-=amountCents;if(!debtors[i].left)i++;if(!creditors[j].left)j++;}
 return {people,stats,expenseCents,incomeCents,expenseCount,transferCount,incomeCount,settlements,outstandingCents};
}
export function validateBook(input){
 const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};const id=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(v);const string=(v,max)=>typeof v==='string'&&v.length<=max;
 assert(input&&typeof input==='object'&&!Array.isArray(input),'账本格式无效。');assert(input.schemaVersion===1&&id(input.id),'账本版本或编号无效。');assert(string(input.title,100)&&input.title.trim(),'请填写账本名称。');assert(input.currency==='USD','当前版本使用 USD。');
 assert(Array.isArray(input.members)&&input.members.length>0&&input.members.length<=50,'账本须有 1–50 位成员。');const ids=new Set();
 const members=input.members.map(m=>{assert(m&&id(m.id)&&!ids.has(m.id)&&!['__proto__','constructor','prototype'].includes(m.id),'成员编号无效或重复。');ids.add(m.id);assert(string(m.name,60)&&m.name.trim(),'成员名称无效。');return {id:m.id,name:m.name.trim(),active:m.active!==false};});
 assert(new Set(members.map(m=>m.name.toLowerCase())).size===members.length,'成员名称不能重复。');assert(Array.isArray(input.entries)&&input.entries.length<=10000,'账目超过 10,000 条或格式无效。');const seen=new Set(),sourceRefs=new Set();let aggregate=0;
 const entries=input.entries.map(e=>{
  assert(e&&id(e.id)&&!seen.has(e.id),'记录编号无效或重复。');seen.add(e.id);assert(['expense','income','transfer'].includes(e.kind),'记录类型无效。');
  assert(typeof e.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(e.date)&&!Number.isNaN(Date.parse(e.date))&&new Date(e.date).toISOString().slice(0,10)===e.date,'日期无效。');assert(ids.has(e.payerId),'付款人不存在。');assert(Number.isSafeInteger(e.amountCents)&&e.amountCents>0&&e.amountCents<=MAX_AMOUNT,'金额无效。');
  aggregate+=e.amountCents*SCALE;assert(Number.isSafeInteger(aggregate)&&aggregate<Number.MAX_SAFE_INTEGER/4,'账本金额超过精度范围。');assert(string(e.description,300)&&e.description.trim(),'请填写用途。');assert(string(e.notes??'',4000),'备注过长。');const shares={};
  if(e.kind==='transfer')assert(ids.has(e.payeeId)&&e.payeeId!==e.payerId,'还款双方必须是不同的成员。');
  else{assert(e.shares&&typeof e.shares==='object'&&!Array.isArray(e.shares),'分摊数据无效。');for(const[k,v]of Object.entries(e.shares)){assert(ids.has(k)&&Number.isSafeInteger(v)&&v>=0,'分摊数据无效。');shares[k]=v;}assert(Object.values(shares).reduce((a,b)=>a+b,0)===e.amountCents*SCALE,'分摊总额与账单不一致。');}
  assert(!e.deletedAt||typeof e.deletedAt==='string'&&!Number.isNaN(Date.parse(e.deletedAt)),'删除日期无效。');
  const source=e.source?validateSource(e.source):null;if(source){assert(sourceFitsEntry(source,e),'金额、币种或类型与 Finances 来源不同，请先解除来源关联。');assert(!sourceRefs.has(source.ref),'同一笔 Finances 交易已关联其他账目（包括回收站）。');sourceRefs.add(source.ref);}
  const fx=e.fx?validateFx(e.fx,e.amountCents):null;assert(!fx||e.splitMode!=='rent','固定房租须使用 USD。');
  const attachments=e.attachments??[];assert(Array.isArray(attachments)&&attachments.length<=MAX_ATTACHMENTS,'每笔账目最多 5 个附件。');const files=attachments.map(validateAttachment);assert(new Set(files.map(a=>a.id)).size===files.length,'附件不能重复。');
  return {id:e.id,kind:e.kind,date:e.date,payerId:e.payerId,...(e.kind==='transfer'?{payeeId:e.payeeId}:{}),amountCents:e.amountCents,...(source?{source}:{}),...(fx?{fx}:{}),...(files.length?{attachments:files}:{}),description:e.description.trim(),shares,splitMode:['equal','amount','percent','shares','imported','rent','transfer'].includes(e.splitMode)?e.splitMode:'imported',category:Object.hasOwn(CATEGORIES,e.category)?e.category:'other',notes:e.notes??'',deletedAt:e.deletedAt||null,...(Number.isInteger(e.sourceRow)?{sourceRow:e.sourceRow}:{}),...(string(e.updatedAt,60)?{updatedAt:e.updatedAt}:{}),...(string(e.createdAt,60)?{createdAt:e.createdAt}:{})};
 });
 let rentRule=null;
 if(input.rentRule){const r=input.rentRule;assert(/^\d{4}-(0[1-9]|1[0-2])$/.test(r.startMonth)&&r.startMonth>='2026-11','房租开始月份无效。');assert(ids.has(r.payerId),'房租付款人不存在。');assert(r.memberIds&&['yuan','zhang','xu','ge'].every(k=>ids.has(r.memberIds[k]))&&new Set(Object.values(r.memberIds)).size===4,'房租参与人无效。');rentRule={enabled:r.enabled===true,startMonth:r.startMonth,payerId:r.payerId,memberIds:Object.fromEntries(['yuan','zhang','xu','ge'].map(k=>[k,r.memberIds[k]]))};}
 return {schemaVersion:1,id:input.id,title:input.title.trim(),currency:'USD',members,entries,rentRule};
}
export function csv(book){
 const safe=v=>{let s=String(v??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};const names=Object.fromEntries(book.members.map(m=>[m.id,m.name]));
 const rows=[['Date','Type','Description','Amount (USD)','Paid by / received by','Paid to','Category','Notes','Original currency','Original amount','USD per unit','Rate date','Rate source','Attachments','Finance source','Finance transaction reference','Finance merchant','Finance date',...book.members.map(m=>m.name+' share (USD)')]];
 for(const e of book.entries.filter(e=>!e.deletedAt))rows.push([e.date,e.kind,e.description,(e.amountCents/100).toFixed(2),names[e.payerId],names[e.payeeId]||'',CATEGORIES[e.category],e.notes,e.fx?.currency||'USD',e.fx?originalText(e.fx.amountMinor,e.fx.currency):(e.amountCents/100).toFixed(2),e.fx?.rate||'1',e.fx?.rateDate||e.date,e.fx?.source||'',(e.attachments||[]).map(a=>a.name+' ['+a.id+']').join('; '),e.source?.provider||'',e.source?.ref||'',e.source?.merchant||'',e.source?.date||'',...book.members.map(m=>e.kind==='transfer'?'':(e.shares[m.id]||0)/SCALE/100)]);
 return '\ufeff'+rows.map(r=>r.map(safe).join(',')).join('\r\n');
}

export function rentShares(rule){
 const m=rule.memberIds;return {[m.yuan]:7375*SCALE,[m.zhang]:84000*SCALE,[m.xu]:60562.5*SCALE,[m.ge]:60562.5*SCALE};
}
export function localDate(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
export function dueRentEntries(book,now=new Date()){
 const r=book.rentRule;if(!r?.enabled)return [];
 const current=localDate(now).slice(0,7),result=[];let month=r.startMonth;
 while(month<=current){
  const exists=book.entries.some(e=>e.id===`rent-${month}`||(e.date.startsWith(month)&&e.kind==='expense'&&e.amountCents===212500&&(e.category==='rent'||/rent|房租/i.test(e.description))));
  if(!exists)result.push({id:`rent-${month}`,kind:'expense',date:`${month}-01`,payerId:r.payerId,amountCents:212500,description:`Base rent · ${month}`,shares:rentShares(r),splitMode:'rent',category:'rent',notes:'每月自动记入 · (yuan + wenchao zhang):xu:ge = 43:28.5:28.5',deletedAt:null,createdAt:now.toISOString()});
  const [y,m]=month.split('-').map(Number);month=m===12?`${y+1}-01`:`${y}-${String(m+1).padStart(2,'0')}`;
 }
 return result;
}
