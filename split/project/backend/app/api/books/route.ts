import {verifyAttachmentReferences} from '@/lib/attachments';
import {allowedWrite,body,db,preflight,reply} from '@/lib/ledger';
import {validateBook} from '@/public/split/core.mjs';
export const OPTIONS=preflight;
export async function POST(req:Request){try{
 allowedWrite(req);const input=await body(req);const book=validateBook(input.book);
 await verifyAttachmentReferences(book);
 if(book.id==='d6')return reply(req,{error:'默认账本已经存在。'},409);
 const now=new Date().toISOString();const result=await db().prepare('INSERT OR IGNORE INTO books (id,document,revision,updated_at) VALUES (?,?,1,?)').bind(book.id,JSON.stringify(book),now).run();
 if(!result.meta.changes)return reply(req,{error:'账本编号已存在。'},409);
 return reply(req,{book,revision:1,updatedAt:now},201);
 }catch(e){return reply(req,{error:e instanceof Error?e.message:'无法创建账本。'},400);}}
