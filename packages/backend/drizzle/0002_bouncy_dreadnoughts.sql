CREATE TABLE `monster_folders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`parent_id` integer,
	FOREIGN KEY (`parent_id`) REFERENCES `monster_folders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `monsters` ADD `cr` real;--> statement-breakpoint
ALTER TABLE `monsters` ADD `creature_type` text;--> statement-breakpoint
ALTER TABLE `monsters` ADD `tags` text;--> statement-breakpoint
ALTER TABLE `monsters` ADD `folder_id` integer REFERENCES monster_folders(id);