-- Create rating_system_config table for storing rating algorithm configuration
CREATE TABLE IF NOT EXISTS "rating_system_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"algorithm_type" varchar(50) DEFAULT 'simple_average' NOT NULL,
	"prior_mean" numeric(3, 1) DEFAULT '7.4',
	"prior_weight" integer DEFAULT 30,
	"likes_alpha" numeric(2, 1) DEFAULT '0.4',
	"likes_max_weight" numeric(2, 1) DEFAULT '3.0',
	"min_text_weight" numeric(2, 1) DEFAULT '0.3',
	"time_decay_enabled" boolean DEFAULT false,
	"time_decay_half_life" integer DEFAULT 180,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Insert default configuration
INSERT INTO "rating_system_config" (
	"algorithm_type",
	"prior_mean",
	"prior_weight",
	"likes_alpha",
	"likes_max_weight",
	"min_text_weight",
	"time_decay_enabled",
	"time_decay_half_life"
) VALUES (
	'simple_average',
	7.4,
	30,
	0.4,
	3.0,
	0.3,
	false,
	180
);
