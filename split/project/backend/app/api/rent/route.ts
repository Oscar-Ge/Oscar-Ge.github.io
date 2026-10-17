import {allowedWrite,preflight,reply} from '@/lib/ledger';
import {rentStatus,applyDueRent} from '@/lib/rent';
export const OPTIONS=preflight;
export async function GET(req:Request){try{return reply(req,await rentStatus());}catch(e){console.error(e);return reply(req,{error:'无法读取房租规则。'},503);}}
export async function POST(req:Request){try{allowedWrite(req);}catch(e){return reply(req,{error:e instanceof Error?e.message:'请求无效。'},400);}try{return reply(req,await applyDueRent());}catch(e){console.error(e);return reply(req,{error:'暂时无法记入房租，请重试。'},503);}}
