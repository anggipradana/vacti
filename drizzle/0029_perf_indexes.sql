CREATE INDEX IF NOT EXISTS "audit_log_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "threat_news_sector_published_idx" ON "threat_news" USING btree ("sector","published_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "endpoints_scan_idx" ON "endpoints" USING btree ("scan_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ports_scan_idx" ON "ports" USING btree ("scan_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scan_activity_scan_idx" ON "scan_activity" USING btree ("scan_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scan_schedules_target_idx" ON "scan_schedules" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scans_project_idx" ON "scans" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scans_target_idx" ON "scans" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subdomains_scan_idx" ON "subdomains" USING btree ("scan_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "targets_project_idx" ON "targets" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vulnerabilities_scan_idx" ON "vulnerabilities" USING btree ("scan_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leakcheck_data_project_idx" ON "leakcheck_data" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "manual_indicators_project_idx" ON "manual_indicators" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "otx_threat_data_project_idx" ON "otx_threat_data" USING btree ("project_id");