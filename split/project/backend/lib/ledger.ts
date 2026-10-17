import {env} from 'cloudflare:workers';
import initial from '../data/initial-book.json';
import {validateBook} from '../public/split/core.mjs';
const origins=new Set(['https://oscar-ge.github.io','https://oscar-shared-split.oscarge0319.chatgpt.site','http://terminal.local:4173']);
export function headers(req:Request){const origin=req.headers.get('origin')||'';return {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin',...(origins.has(origin)?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, PUT, OPTIONS','Access-Control-Allow-Headers':'Content-Type'}:{})};}
export function reply(req:Request,body:unknown,status=200){const requestId=crypto.randomUUID();console.log(JSON.stringify({event:'ledger_api',requestId,method:req.method,path:new URL(req.url).pathname,status}));return new Response(JSON.stringify(body),{status,headers:{...headers(req),'X-Request-Id':requestId}});}
export function preflight(req:Request){return new Response(null,{status:204,headers:headers(req)});}
export function db(){if(!env.DB)throw new Error('Shared database is unavailable.');return env.DB;}
export async function ensureInitialBook(){const book=validateBook(initial);await db().prepare('INSERT OR IGNORE INTO books (id,document,revision,updated_at) VALUES (?,?,1,?)').bind(book.id,JSON.stringify(book),new Date().toISOString()).run();}
export async function body(req:Request){if(Number(req.headers.get('content-length')||0)>4_000_000)throw new Error('文件过大。');const raw=await req.text();if(raw.length>4_000_000)throw new Error('文件过大。');return JSON.parse(raw);}
export function allowedWrite(req:Request){const origin=req.headers.get('origin');if(origin&&!origins.has(origin))throw new Error('来源不受支持。');if(!req.headers.get('content-type')?.includes('application/json'))throw new Error('请使用 JSON。');}
export type BookRow={document:string;revision:number;updated_at:string};
export async function readBook(id:string){return db().prepare('SELECT document,revision,updated_at FROM books WHERE id=?').bind(id).first<BookRow>();}
export async function replaceBook(book:ReturnType<typeof validateBook>,revision:number){
 const now=new Date().toISOString();const result=await db().batch([
  db().prepare('INSERT INTO book_history (book_id,document,revision,created_at) SELECT id,document,revision,? FROM books WHERE id=? AND revision=?').bind(now,book.id,revision),
  db().prepare('UPDATE books SET document=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').bind(JSON.stringify(book),now,book.id,revision)
 ]);
 return result[1].meta.changes?{book,revision:revision+1,updatedAt:now}:null;
}
