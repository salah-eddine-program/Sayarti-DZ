CREATE TABLE `documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`vehicleId` int NOT NULL,
	`title` varchar(160) NOT NULL,
	`expiresOn` date,
	`fileUrl` varchar(2048),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`vehicleId` int NOT NULL,
	`title` varchar(160) NOT NULL,
	`category` enum('service','fuel','parts','other') NOT NULL,
	`amount` int NOT NULL DEFAULT 0,
	`expenseDate` date NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `expenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fuelLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`vehicleId` int NOT NULL,
	`amount` int NOT NULL DEFAULT 0,
	`liters` int NOT NULL DEFAULT 0,
	`pricePerLiter` int NOT NULL DEFAULT 0,
	`mileage` int NOT NULL,
	`fuelDate` date NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fuelLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `maintenance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`vehicleId` int NOT NULL,
	`title` varchar(160) NOT NULL,
	`serviceDate` date NOT NULL,
	`mileage` int NOT NULL,
	`cost` int NOT NULL DEFAULT 0,
	`notes` text,
	`invoiceUrl` varchar(2048),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `maintenance_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vehicles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`brand` varchar(80) NOT NULL,
	`model` varchar(80) NOT NULL,
	`year` int NOT NULL,
	`fuelType` enum('diesel','petrol','lpg','electric') NOT NULL,
	`mileage` int NOT NULL DEFAULT 0,
	`plateNumber` varchar(32),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vehicles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `language` enum('ar','fr','en') DEFAULT 'ar' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `theme` enum('light','dark') DEFAULT 'light' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `profileLink` varchar(2048);--> statement-breakpoint
ALTER TABLE `users` ADD `plan` enum('free','premium') DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `premiumExpiresAt` timestamp;--> statement-breakpoint
ALTER TABLE `documents` ADD CONSTRAINT `documents_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `documents` ADD CONSTRAINT `documents_vehicleId_vehicles_id_fk` FOREIGN KEY (`vehicleId`) REFERENCES `vehicles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_vehicleId_vehicles_id_fk` FOREIGN KEY (`vehicleId`) REFERENCES `vehicles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fuelLogs` ADD CONSTRAINT `fuelLogs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fuelLogs` ADD CONSTRAINT `fuelLogs_vehicleId_vehicles_id_fk` FOREIGN KEY (`vehicleId`) REFERENCES `vehicles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `maintenance` ADD CONSTRAINT `maintenance_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `maintenance` ADD CONSTRAINT `maintenance_vehicleId_vehicles_id_fk` FOREIGN KEY (`vehicleId`) REFERENCES `vehicles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vehicles` ADD CONSTRAINT `vehicles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `documents_owner_idx` ON `documents` (`userId`,`vehicleId`);--> statement-breakpoint
CREATE INDEX `expenses_owner_idx` ON `expenses` (`userId`,`vehicleId`);--> statement-breakpoint
CREATE INDEX `fuel_owner_idx` ON `fuelLogs` (`userId`,`vehicleId`);--> statement-breakpoint
CREATE INDEX `maintenance_owner_idx` ON `maintenance` (`userId`,`vehicleId`);--> statement-breakpoint
CREATE INDEX `vehicles_user_idx` ON `vehicles` (`userId`);