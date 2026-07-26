CREATE TABLE `monsters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`max_hp` integer DEFAULT 0 NOT NULL,
	`initiative_modifier` integer DEFAULT 0 NOT NULL,
	`stat_block` text,
	`created_at` text NOT NULL
);
