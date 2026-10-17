CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`object_key` text NOT NULL,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`sha256` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `attachments_book_idx` ON `attachments` (`book_id`);--> statement-breakpoint
CREATE TABLE `fx_rates` (
	`id` text PRIMARY KEY NOT NULL,
	`rate` text NOT NULL,
	`rate_date` text NOT NULL,
	`updated_at` text NOT NULL
);
