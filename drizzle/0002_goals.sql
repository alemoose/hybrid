CREATE TABLE `body_weights` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`logged_at` integer NOT NULL,
	`weight` real NOT NULL
);
--> statement-breakpoint
CREATE INDEX `body_weights_at_idx` ON `body_weights` (`logged_at`);--> statement-breakpoint
CREATE TABLE `goal_targets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group` text NOT NULL,
	`kind` text NOT NULL,
	`key` text NOT NULL,
	`label` text NOT NULL,
	`start_value` real,
	`target_value` real NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `measurements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`logged_at` integer NOT NULL,
	`kind` text NOT NULL,
	`value` real NOT NULL
);
--> statement-breakpoint
CREATE INDEX `measurements_kind_idx` ON `measurements` (`kind`,`logged_at`);--> statement-breakpoint
CREATE TABLE `photos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`pose` text DEFAULT '' NOT NULL,
	`taken_at` integer NOT NULL,
	`mime` text NOT NULL,
	`width` integer DEFAULT 0 NOT NULL,
	`height` integer DEFAULT 0 NOT NULL,
	`data` blob NOT NULL
);
--> statement-breakpoint
CREATE INDEX `photos_kind_idx` ON `photos` (`kind`,`pose`,`taken_at`);