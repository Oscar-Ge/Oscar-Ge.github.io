import {CURRENCIES,validDate} from './currency.mjs';
export function validateSource(s){
 if(!s||s.provider!=='finances'||!/^fin-[a-f0-9]{64}$/.test(s.ref)||!validDate(s.date)||!Object.hasOwn(CURRENCIES,s.currency)||!Number.isSafeInteger(s.amountMinor)||s.amountMinor<=0||s.amountMinor>1e12||typeof s.merchant!=='string'||!s.merchant.trim()||s.merchant.length>160||typeof s.importedAt!=='string'||!Number.isFinite(Date.parse(s.importedAt)))throw new Error('Finances 来源格式无效。');
 return {provider:'finances',ref:s.ref,date:s.date,currency:s.currency,amountMinor:s.amountMinor,merchant:s.merchant.trim(),importedAt:s.importedAt};
}
export function validateFinancePacket(input){
 if(input?.format!=='split-finances-v1'||!Array.isArray(input.transactions)||input.transactions.length>1500)throw new Error('请选择 ChatGPT 生成的 Finances 导入文件。');
 const transactions=input.transactions.map(validateSource);if(new Set(transactions.map(t=>t.ref)).size!==transactions.length)throw new Error('导入文件中有重复交易。');return transactions;
}
export function sourceFitsEntry(source,e){return e.kind==='expense'&&source.currency===(e.fx?.currency||'USD')&&source.amountMinor===(e.fx?.amountMinor||e.amountCents);}
const normalize=s=>s.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g,'');
function merchantKey(s){const n=normalize(s);for(const [key,pattern] of [['xfinity',/xfinity|comcast|network|^xf\d/],['dte',/dte|electronic|electronical|elecgas|energy|^\d{4}gas$/],['aaa',/aaa|houseinsurance|房屋保险/],['sams',/samsclub|sams\d/],['mcdonald',/mcdonald|mcdounald/],['way1',/way1/],['claude',/claude|anthropic/]])if(pattern.test(n))return key;for(const key of ['kroger','walmart','weee','amazon','aldi','costco','kfc','arbys'])if(n.includes(key))return key;return n;}
export function suggestFinanceLinks(book,transactions,payerId){
 const used=new Set(book.entries.filter(e=>e.source).map(e=>e.source.ref));const entries=book.entries.filter(e=>!e.deletedAt&&!e.source&&e.payerId===payerId&&e.kind==='expense');
 const options=[];for(const t of transactions){if(used.has(t.ref))continue;const key=merchantKey(t.merchant);const candidates=entries.filter(e=>sourceFitsEntry(t,e)&&Math.abs(Date.parse(e.date)-Date.parse(t.date))<=7*86400000&&key&&key===merchantKey(e.description));if(candidates.length===1)options.push({entryId:candidates[0].id,source:t});}
 return options.filter(p=>options.filter(q=>q.entryId===p.entryId).length===1);
}
export function attachFinanceLinks(book,links){
 const used=new Set(book.entries.filter(e=>e.source).map(e=>e.source.ref));let count=0;
 for(const {entryId,source:raw}of links){const source=validateSource(raw),e=book.entries.find(e=>e.id===entryId);if(e?.source?.ref===source.ref)continue;if(!e||e.deletedAt||e.source||used.has(source.ref)||!sourceFitsEntry(source,e))throw new Error('账目或来源已变化，请重新预览导入。');e.source=source;used.add(source.ref);count++;}return count;
}
