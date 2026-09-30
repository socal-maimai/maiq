ALTER TABLE "discord_status_messages" DROP CONSTRAINT "discord_status_messages_pkey";--> statement-breakpoint
ALTER TABLE "discord_status_messages" ADD CONSTRAINT "discord_status_messages_channel_id_line_id_pk" PRIMARY KEY("channel_id","line_id");--> statement-breakpoint
CREATE INDEX "discord_status_messages_line_idx" ON "discord_status_messages" USING btree ("line_id");