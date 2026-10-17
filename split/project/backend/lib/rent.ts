import {ensureInitialBook,readBook,replaceBook} from './ledger';
import {dueRentEntries,localDate,validateBook,summarize} from '../public/split/core.mjs';
export async function rentStatus(){await ensureInitialBook();const row=await readBook('d6');if(!row)throw new Error('账本不存在。');const book=validateBook(JSON.parse(row.document));return {bookId:'d6',localDate:localDate(),timezone:'America/New_York',rule:book.rentRule,revision:row.revision,dueMonths:dueRentEntries(book).map(e=>e.date.slice(0,7)),generatedMonths:book.entries.filter((e:{id:string})=>e.id.startsWith('rent-')).map((e:{id:string;date:string;deletedAt?:string|null})=>({month:e.date.slice(0,7),id:e.id,deleted:!!e.deletedAt})),summary:summarize(book)};}
export async function applyDueRent(){
 await ensureInitialBook();
 for(let attempt=0;attempt<5;attempt++){
  const row=await readBook('d6');if(!row)throw new Error('账本不存在。');const book=validateBook(JSON.parse(row.document));const entries=dueRentEntries(book);
  if(!entries.length)return {bookId:'d6',addedMonths:[],revision:row.revision,reason:book.rentRule?.enabled?'没有未记入的到期房租。':'自动房租已暂停。',localDate:localDate()};
  book.entries.push(...entries);const result=await replaceBook(validateBook(book),row.revision);
  if(result)return {bookId:'d6',addedMonths:entries.map(e=>e.date.slice(0,7)),revision:result.revision,localDate:localDate()};
 }
 throw new Error('账本正在频繁更新，请稍后重试。');
}
