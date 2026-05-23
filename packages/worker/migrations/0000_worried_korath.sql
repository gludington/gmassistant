CREATE TABLE `adventure_players` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`adventure_id` integer NOT NULL,
	`name` text NOT NULL,
	`max_hp` integer DEFAULT 10 NOT NULL,
	`initiative_modifier` integer DEFAULT 0 NOT NULL,
	`color` text,
	`armor_class` integer,
	`spell_dc` integer,
	`passive_perception` integer,
	FOREIGN KEY (`adventure_id`) REFERENCES `adventures`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `adventures` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`show_hp` integer DEFAULT false NOT NULL,
	`show_initiative` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `combatants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`encounter_id` integer NOT NULL,
	`name` text NOT NULL,
	`max_hp` integer NOT NULL,
	`initiative_modifier` integer DEFAULT 0 NOT NULL,
	`type` text DEFAULT 'enemy' NOT NULL,
	`color` text,
	`description` text,
	`visible_to_players` integer DEFAULT true NOT NULL,
	`stat_block` text,
	FOREIGN KEY (`encounter_id`) REFERENCES `encounters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `encounters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`adventure_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`playlist_id` integer,
	FOREIGN KEY (`adventure_id`) REFERENCES `adventures`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`playlist_id`) REFERENCES `playlists`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `group_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`combatant_id` integer NOT NULL,
	`label` text NOT NULL,
	`max_hp` integer DEFAULT 10 NOT NULL,
	FOREIGN KEY (`combatant_id`) REFERENCES `combatants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `image_scenes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`adventure_id` integer NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`adventure_id`) REFERENCES `adventures`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `playlist_tracks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`playlist_id` integer NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'file' NOT NULL,
	`url` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`playlist_id`) REFERENCES `playlists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `playlists` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`adventure_id` integer NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`adventure_id`) REFERENCES `adventures`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `scene_images` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`scene_id` integer NOT NULL,
	`file_path` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`fit` text DEFAULT 'fit' NOT NULL,
	`playlist_id` integer,
	FOREIGN KEY (`scene_id`) REFERENCES `image_scenes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`playlist_id`) REFERENCES `playlists`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`adventure_id` integer NOT NULL,
	`name` text NOT NULL,
	`date` text NOT NULL,
	`notes` text,
	FOREIGN KEY (`adventure_id`) REFERENCES `adventures`(`id`) ON UPDATE no action ON DELETE cascade
);
