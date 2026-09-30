CREATE TABLE "button_reports" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "button_reports_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"line_id" text NOT NULL,
	"cab" smallint NOT NULL,
	"side" smallint NOT NULL,
	"button" smallint NOT NULL,
	"kind" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"reporter" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "button_reports_cab_range" CHECK ("button_reports"."cab" between 1 and 20),
	CONSTRAINT "button_reports_side" CHECK ("button_reports"."side" in (1, 2)),
	CONSTRAINT "button_reports_button_range" CHECK ("button_reports"."button" between 1 and 8),
	CONSTRAINT "button_reports_kind" CHECK ("button_reports"."kind" in ('works', 'unreliable', 'broken')),
	CONSTRAINT "button_reports_description" CHECK (char_length("button_reports"."description") <= 280 and ("button_reports"."kind" = 'works' or char_length(btrim("button_reports"."description")) > 0))
);
--> statement-breakpoint
CREATE INDEX "button_reports_button_created_idx" ON "button_reports" USING btree ("line_id","cab","side","button","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "button_reports_reporter_created_idx" ON "button_reports" USING btree ("reporter","created_at" DESC NULLS LAST);