CREATE TABLE "muted_reporters" (
	"reporter" text PRIMARY KEY NOT NULL,
	"muted_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "button_reports" ADD COLUMN "hidden_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "button_reports" ADD COLUMN "hidden_by" text;--> statement-breakpoint
ALTER TABLE "button_reports" ADD COLUMN "test" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "queue_reports" ADD COLUMN "hidden_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "queue_reports" ADD COLUMN "hidden_by" text;--> statement-breakpoint
ALTER TABLE "queue_reports" ADD COLUMN "test" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "button_reports_created_idx" ON "button_reports" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "queue_reports_created_idx" ON "queue_reports" USING btree ("created_at" DESC NULLS LAST);