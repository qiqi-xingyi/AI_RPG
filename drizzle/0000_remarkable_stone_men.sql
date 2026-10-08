CREATE TABLE `game_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`visitor` text NOT NULL,
	`state` text NOT NULL,
	`updated_at` integer NOT NULL,
	`lease_id` text,
	`lease_until` integer
);
--> statement-breakpoint
CREATE TABLE `usage_buckets` (
	`bucket` text PRIMARY KEY NOT NULL,
	`used` integer NOT NULL,
	`expires_at` integer NOT NULL
);
