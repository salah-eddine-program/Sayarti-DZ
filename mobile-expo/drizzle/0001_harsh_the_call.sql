CREATE TABLE `sayarti_accounts` (
	`id` varchar(36) NOT NULL,
	`email` varchar(320) NOT NULL,
	`firstName` varchar(100) NOT NULL,
	`lastName` varchar(100) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sayarti_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `sayarti_accounts_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `sayarti_email_challenges` (
	`id` varchar(36) NOT NULL,
	`email` varchar(320) NOT NULL,
	`purpose` enum('signup','login') NOT NULL,
	`codeHash` varchar(64) NOT NULL,
	`attempts` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	`consumedAt` timestamp,
	CONSTRAINT `sayarti_email_challenges_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sayarti_sessions` (
	`tokenHash` varchar(64) NOT NULL,
	`accountId` varchar(36) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	CONSTRAINT `sayarti_sessions_tokenHash` PRIMARY KEY(`tokenHash`)
);
--> statement-breakpoint
CREATE INDEX `sayarti_challenges_email_created_idx` ON `sayarti_email_challenges` (`email`,`createdAt`);--> statement-breakpoint
CREATE INDEX `sayarti_sessions_account_idx` ON `sayarti_sessions` (`accountId`);