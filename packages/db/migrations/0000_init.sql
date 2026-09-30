CREATE TABLE "discord_status_messages" (
	"line_id" text PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"message_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "queue_reports" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "queue_reports_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"line_id" text NOT NULL,
	"players" smallint NOT NULL,
	"queue" smallint NOT NULL,
	"kind" text NOT NULL,
	"source" text NOT NULL,
	"reporter" text NOT NULL,
	"in_geofence" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "queue_reports_players_range" CHECK ("queue_reports"."players" between 0 and 8),
	CONSTRAINT "queue_reports_queue_range" CHECK ("queue_reports"."queue" between 0 and 40),
	CONSTRAINT "queue_reports_kind" CHECK ("queue_reports"."kind" in ('report', 'confirm')),
	CONSTRAINT "queue_reports_source" CHECK ("queue_reports"."source" in ('web', 'discord'))
);
--> statement-breakpoint
CREATE INDEX "discord_status_messages_channel_idx" ON "discord_status_messages" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "queue_reports_line_created_idx" ON "queue_reports" USING btree ("line_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "queue_reports_reporter_line_created_idx" ON "queue_reports" USING btree ("reporter","line_id","created_at" DESC NULLS LAST);