import {db,reply,preflight} from '@/lib/ledger';
export const OPTIONS=preflight;
export async function GET(req:Request){try{await db().prepare('SELECT 1 AS ok FROM books LIMIT 1').first();return reply(req,{status:'ok',database:'connected',schema:1});}catch(e){console.error(e);return reply(req,{status:'error',database:'unavailable'},503);}}
