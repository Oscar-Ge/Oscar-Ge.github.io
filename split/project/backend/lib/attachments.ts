import {env} from 'cloudflare:workers';
import {db} from './ledger';
import {MAX_ATTACHMENT_SIZE,cleanFileName,detectFileType,validateAttachment} from '../public/split/attachments.mjs';
export class FileInputError extends Error {status:number;constructor(message:string,status=400){super(message);this.status=status;}}
export type FileRow={id:string;book_id:string;object_key:string;name:string;mime:string;size:number;sha256:string;created_at:string};
export function bucket(){if(!env.BUCKET)throw new Error('File storage unavailable.');return env.BUCKET;}
export function publicFile(row:FileRow){return validateAttachment({id:row.id,name:row.name,mime:row.mime,size:row.size});}
export async function getFile(bookId:string,id:string){return db().prepare('SELECT * FROM attachments WHERE book_id=? AND id=?').bind(bookId,id).first<FileRow>();}
export async function readUpload(req:Request){
 const max=MAX_ATTACHMENT_SIZE+65536;if(Number(req.headers.get('content-length')||0)>max)throw new FileInputError('每个附件不能超过 10 MB。',413);
 if(!req.body)throw new FileInputError('请选择附件。');const reader=req.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>max){await reader.cancel();throw new FileInputError('每个附件不能超过 10 MB。',413);}chunks.push(part.value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 let form:FormData;try{form=await new Response(bytes,{headers:{'Content-Type':req.headers.get('content-type')||''}}).formData();}catch{throw new FileInputError('附件请求格式无效。');}
 const file=form.get('file'),id=form.get('id');if(!file||typeof file==='string'||!file.size||file.size>MAX_ATTACHMENT_SIZE)throw new FileInputError('请选择 10 MB 以内的非空附件。',413);
 if(typeof id!=='string'||!/^att-[a-f0-9-]{36}$/.test(id))throw new FileInputError('附件编号无效。');
 const content=await file.arrayBuffer();let mime;try{mime=detectFileType(new Uint8Array(content));}catch(e){throw new FileInputError(e instanceof Error?e.message:'不支持这个文件。',415);}
 const sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',content))].map(n=>n.toString(16).padStart(2,'0')).join('');
 return {id,name:cleanFileName(file.name),mime,size:file.size,sha256,content};
}
export async function storeFile(bookId:string,file:Awaited<ReturnType<typeof readUpload>>){
 const existing=await getFile(bookId,file.id);if(existing){if(existing.sha256!==file.sha256)throw new FileInputError('附件编号已用于其他文件。',409);return publicFile(existing);}
 const count=await db().prepare('SELECT COUNT(*) AS n FROM attachments WHERE book_id=?').bind(bookId).first<{n:number}>();if((count?.n||0)>=1000)throw new FileInputError('此账本已达到 1,000 个附件的存储上限。',413);
 const key=`books/${bookId}/${file.id}/${file.sha256}`;await bucket().put(key,file.content,{httpMetadata:{contentType:file.mime}});
 try{
  await db().prepare('INSERT OR IGNORE INTO attachments (id,book_id,object_key,name,mime,size,sha256,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(file.id,bookId,key,file.name,file.mime,file.size,file.sha256,new Date().toISOString()).run();
  const saved=await getFile(bookId,file.id);if(!saved||saved.sha256!==file.sha256)throw new FileInputError('附件编号冲突，请重新选择文件。',409);return publicFile(saved);
 }catch(e){const row=await getFile(bookId,file.id);if(row?.object_key!==key)await bucket().delete(key);throw e;}
}
export async function verifyAttachmentReferences(book:{id:string;entries:Array<{attachments?:Array<{id:string;name:string;mime:string;size:number}>}>}){
 const refs=book.entries.flatMap(e=>e.attachments||[]);if(!refs.length)return;
 const result=await db().prepare('SELECT * FROM attachments WHERE book_id=?').bind(book.id).all<FileRow>();const files=new Map(result.results.map(a=>[a.id,a]));
 for(const ref of refs){const stored=files.get(ref.id);if(!stored||stored.name!==ref.name||stored.mime!==ref.mime||stored.size!==ref.size)throw new FileInputError('附件不存在或不属于这个账本，请重新上传。');}
}
