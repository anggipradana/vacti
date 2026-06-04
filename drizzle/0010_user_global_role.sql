ALTER TABLE "users" ADD COLUMN "role" text DEFAULT 'PenetrationTester' NOT NULL;
--> statement-breakpoint
UPDATE "users" SET "role" = 'SysAdmin' WHERE "is_sys_admin" = true;
