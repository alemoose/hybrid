CREATE TABLE `habit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`habit` text NOT NULL,
	`day` text NOT NULL,
	`logged_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `habit_logs_day_idx` ON `habit_logs` (`habit`,`day`);