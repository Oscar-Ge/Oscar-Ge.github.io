import {index,integer,sqliteTable,text} from 'drizzle-orm/sqlite-core';
export const books=sqliteTable('books',{id:text('id').primaryKey(),document:text('document').notNull(),revision:integer('revision').notNull().default(1),updatedAt:text('updated_at').notNull()});
export const bookHistory=sqliteTable('book_history',{id:integer('id').primaryKey({autoIncrement:true}),bookId:text('book_id').notNull(),document:text('document').notNull(),revision:integer('revision').notNull(),createdAt:text('created_at').notNull()});

export const attachments=sqliteTable('attachments',{id:text('id').primaryKey(),bookId:text('book_id').notNull(),objectKey:text('object_key').notNull(),name:text('name').notNull(),mime:text('mime').notNull(),size:integer('size').notNull(),sha256:text('sha256').notNull(),createdAt:text('created_at').notNull()},table=>[index('attachments_book_idx').on(table.bookId)]);
export const fxRates=sqliteTable('fx_rates',{id:text('id').primaryKey(),rate:text('rate').notNull(),rateDate:text('rate_date').notNull(),updatedAt:text('updated_at').notNull()});
