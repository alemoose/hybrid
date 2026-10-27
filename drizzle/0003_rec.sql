CREATE TABLE `rec_samples` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`location_id` integer NOT NULL,
	`location` text NOT NULL,
	`count` integer NOT NULL,
	`capacity` integer NOT NULL,
	`updated` text NOT NULL,
	`recorded_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rec_samples_update_idx` ON `rec_samples` (`location_id`,`updated`);