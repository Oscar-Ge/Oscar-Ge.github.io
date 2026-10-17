import {allowedWrite,preflight,readBook,reply} from '@/lib/ledger';
import {FileInputError,readUpload,storeFile} from '@/lib/attachments';
type Context={params:Promise<{id:string}>};
export const OPTIONS=preflight;
export async function POST(req:Request,ctx:Context){try{allowedWrite(req,'multipart/form-data');}catch(e){return reply(req,{error:e instanceof Error?e.message:'请求格式无效。'},400);}try{
 const {id}=await ctx.params;if(!await readBook(id))return reply(req,{error:'没有找到这个账本。'},404);
 const attachment=await storeFile(id,await readUpload(req));return reply(req,{attachment},201);
 }catch(e){if(e instanceof FileInputError)return reply(req,{error:e.message},e.status);console.error(e);return reply(req,{error:'附件上传失败，请重试。'},503);}}
