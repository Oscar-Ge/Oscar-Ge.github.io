import {integer,sqliteTable,text} from 'drizzle-orm/sqlite-core';
export const books=sqliteTable('books',{id:text('id').primaryKey(),document:text('document').notNull(),revision:integer('revision').notNull().default(1),updatedAt:text('updated_at').notNull()});
export const bookHistory=sqliteTable('book_history',{id:integer('id').primaryKey({autoIncrement:true}),bookId:text('book_id').notNull(),document:text('document').notNull(),revision:integer('revision').notNull(),createdAt:text('created_at').notNull()});
