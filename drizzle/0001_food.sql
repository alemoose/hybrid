CREATE TABLE `estimate_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`result_json` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `meal_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`meal_log_id` integer NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`name` text NOT NULL,
	`quantity` real DEFAULT 1 NOT NULL,
	`unit` text DEFAULT 'serving' NOT NULL,
	`calories` real DEFAULT 0 NOT NULL,
	`protein` real DEFAULT 0 NOT NULL,
	`carbs` real DEFAULT 0 NOT NULL,
	`fat` real DEFAULT 0 NOT NULL,
	`sodium` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`meal_log_id`) REFERENCES `meal_logs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `meal_items_log_idx` ON `meal_items` (`meal_log_id`);--> statement-breakpoint
CREATE TABLE `meal_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`eaten_at` integer NOT NULL,
	`meal` text NOT NULL,
	`title` text NOT NULL,
	`restaurant` text DEFAULT '' NOT NULL,
	`source` text DEFAULT 'estimate' NOT NULL,
	`price_cents` integer,
	`usual_id` integer,
	`calories` real DEFAULT 0 NOT NULL,
	`protein` real DEFAULT 0 NOT NULL,
	`carbs` real DEFAULT 0 NOT NULL,
	`fat` real DEFAULT 0 NOT NULL,
	`sodium` real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `meal_logs_eaten_idx` ON `meal_logs` (`eaten_at`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `usuals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`restaurant` text DEFAULT '' NOT NULL,
	`source` text DEFAULT 'estimate' NOT NULL,
	`price_cents` integer,
	`items_json` text NOT NULL,
	`use_count` integer DEFAULT 0 NOT NULL,
	`last_used_at` integer,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `water_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`logged_at` integer NOT NULL,
	`ounces` real NOT NULL
);
--> statement-breakpoint
CREATE INDEX `water_logs_at_idx` ON `water_logs` (`logged_at`);