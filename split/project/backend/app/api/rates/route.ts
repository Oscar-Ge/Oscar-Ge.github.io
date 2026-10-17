import {db,preflight,reply} from '@/lib/ledger';
import {CURRENCIES,normalizeRate,validDate} from '@/public/split/currency.mjs';
import {localDate} from '@/public/split/core.mjs';
export const OPTIONS=preflight;
type RateRow={rate:string;rate_date:string;updated_at:string};
export async function GET(req:Request){const q=new URL(req.url).searchParams,currency=q.get('currency')||'',date=q.get('date')||localDate();
 if(!Object.hasOwn(CURRENCIES,currency)||currency==='USD'||!validDate(date)||date>localDate())return reply(req,{error:'请选择有效的外币和不晚于今天的日期；未来账目可手动输入汇率。'},400);
 try{const key=`${currency}:${date}`,cached=await db().prepare('SELECT rate,rate_date,updated_at FROM fx_rates WHERE id=?').bind(key).first<RateRow>();
 if(cached&&Date.now()-Date.parse(cached.updated_at)<3600000)return reply(req,{currency,quote:'USD',rate:cached.rate,date:cached.rate_date,source:'frankfurter',cached:true});
 const url=`https://api.frankfurter.dev/v2/rate/${currency.toLowerCase()}/usd?date=${date}`;const response=await fetch(url,{signal:AbortSignal.timeout(12000),headers:{Accept:'application/json'}});if(!response.ok)throw new Error(`rate provider ${response.status}`);
 const rateData=await response.json() as {base:string;quote:string;rate:number;date:string};if(rateData.base!==currency||rateData.quote!=='USD'||!Number.isFinite(rateData.rate)||!validDate(rateData.date)||rateData.date>date)throw new Error('Invalid rate provider response.');
 const rate=normalizeRate(rateData.rate.toFixed(12)).text;
 await db().prepare('INSERT INTO fx_rates (id,rate,rate_date,updated_at) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET rate=excluded.rate,rate_date=excluded.rate_date,updated_at=excluded.updated_at').bind(key,rate,rateData.date,new Date().toISOString()).run();
 return reply(req,{currency,quote:'USD',rate,date:rateData.date,source:'frankfurter',cached:false});
 }catch(e){console.error(e);return reply(req,{error:'暂时无法取得参考汇率，请按实际付款记录手动填写汇率。'},503);}}
