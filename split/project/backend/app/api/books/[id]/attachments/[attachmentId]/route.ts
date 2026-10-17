import {headers,preflight,reply} from '@/lib/ledger';
import {bucket,getFile} from '@/lib/attachments';
import {previewable} from '@/public/split/attachments.mjs';
type Context={params:Promise<{id:string;attachmentId:string}>};
export const OPTIONS=preflight;
export async function GET(req:Request,ctx:Context){try{
 const {id,attachmentId}=await ctx.params;const row=await getFile(id,attachmentId);if(!row)return reply(req,{error:'没有找到这个附件。'},404);
 const file=await bucket().get(row.object_key);if(!file)return reply(req,{error:'附件文件不可用。'},404);
 const disposition=previewable(row.mime)&&!new URL(req.url).searchParams.has('download')?'inline':'attachment';
 return new Response(file.body,{headers:{...headers(req),'Content-Type':row.mime,'Content-Length':String(row.size),'Content-Disposition':`${disposition}; filename="receipt"; filename*=UTF-8''${encodeURIComponent(row.name).replace(/'/g,'%27')}`,'Cache-Control':'public, max-age=86400, immutable','ETag':file.httpEtag,'X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none';"}});
 }catch(e){console.error(e);return reply(req,{error:'附件暂时无法读取，请重试。'},503);}}
