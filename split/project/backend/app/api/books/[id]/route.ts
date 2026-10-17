import {FileInputError,verifyAttachmentReferences} from '@/lib/attachments';
import {allowedWrite,body,ensureInitialBook,preflight,reply,readBook,replaceBook} from '@/lib/ledger';
import {validateBook} from '@/public/split/core.mjs';
type Context={params:Promise<{id:string}>};
export const OPTIONS=preflight;
export async function GET(req:Request,ctx:Context){try{
 const {id}=await ctx.params;if(id==='d6')await ensureInitialBook();const row=await readBook(id);
 if(!row)return reply(req,{error:'没有找到这个账本。'},404);
 return reply(req,{book:JSON.parse(row.document),revision:row.revision,updatedAt:row.updated_at});
 }catch(e){console.error(e);return reply(req,{error:'暂时无法读取共享账本，请稍后重试。'},503);}}
export async function PUT(req:Request,ctx:Context){
 let book,revision,clientVersion;try{allowedWrite(req);const {id}=await ctx.params;const input=await body(req);book=validateBook(input.book);revision=input.revision;clientVersion=input.clientVersion;
 if(book.id!==id||!Number.isSafeInteger(revision)||revision<1)throw new Error('账本版本无效。');
 }catch(e){return reply(req,{error:e instanceof Error?e.message:'无法保存。'},400);}
 try{const current=await readBook(book.id);if(clientVersion!==2&&[...book.entries,...(current?JSON.parse(current.document).entries:[])].some(e=>e.fx||e.attachments?.length||e.source))return reply(req,{error:'这个账本已使用多币种、附件或交易来源，请刷新网页后再保存，避免丢失信息。'},409);await verifyAttachmentReferences(book);const result=await replaceBook(book,revision);if(!result)return reply(req,{error:'其他人刚更新了账本。请刷新后重试，你的草稿仍保留在窗口中。'},409);return reply(req,result);
 }catch(e){if(e instanceof FileInputError)return reply(req,{error:e.message},e.status);console.error(e);return reply(req,{error:'共享数据库暂时无法保存，请稍后重试。'},503);}
}
