import {uid,splitAmount} from '../core.mjs';
export async function runApiTests(origin,report=console.log){
 const check=(ok,message)=>{if(!ok)throw new Error(message);report('PASS · '+message);};
 const api=async(path,method='GET',data)=>{const r=await fetch(origin+'/api'+path,{method,headers:{'Content-Type':'application/json',...(origin.startsWith('http://127.0.0.1')?{Origin:'https://oscar-ge.github.io'}:{})},...(data?{body:JSON.stringify(data)}:{})});return {status:r.status,cors:r.headers.get('Access-Control-Allow-Origin'),data:await r.json()};};
 check((await api('/health')).status===200,'database connection');
 const original=await api('/books/d6');check(original.data.book.entries.length===344,'all 344 source entries persisted');
 const book={schemaVersion:1,id:'test-'+uid(),title:'UI / API 测试账本',currency:'USD',members:original.data.book.members,entries:[],rentRule:original.data.book.rentRule};
 check((await api('/books','POST',{book})).status===201,'create isolated test book');check((await api('/books','POST',{book})).status===409,'duplicate book rejected');
 book.entries.push({id:uid(),kind:'expense',date:'2026-10-17',description:'QA test $10',payerId:'ge',amountCents:1000,shares:splitAmount(1000,'equal',{ge:1,xu:1}),category:'other'});
 const concurrent=await Promise.all([api('/books/'+book.id,'PUT',{book,revision:1}),api('/books/'+book.id,'PUT',{book:{...book,title:'UI / API 测试账本'},revision:1})]);check(JSON.stringify(concurrent.map(r=>r.status).sort())==='[200,409]','simultaneous updates: one success, one conflict');
 const current=await api('/books/'+book.id);check(current.data.revision===2&&current.data.book.entries.length===1,'saved version and entry read back');
 const broken=structuredClone(book);broken.entries[0].shares.ge=0;check((await api('/books/'+book.id,'PUT',{book:broken,revision:2})).status===400,'unbalanced shares rejected');
 check((await api('/books/not-found')).status===404,'missing ledger returns 404');
 const before=await api('/rent'),write=await api('/rent','POST',{}),after=await api('/rent');check(write.status===200&&write.data.addedMonths.length===0&&before.data.revision===after.data.revision,'rent writer is a safe no-op before November');
 const mcp=await fetch(origin+'/mcp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'get_ledger_summary',arguments:{}}})});check((await mcp.json()).result.isError===false,'MCP summary reader');
 return book.id;
}
