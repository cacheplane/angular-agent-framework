ALTER TABLE "licenses" RENAME COLUMN "stripe_payment_id" TO "stripe_subscription_id";--> statement-breakpoint
ALTER TABLE "licenses" RENAME CONSTRAINT "licenses_stripe_payment_id_unique" TO "licenses_stripe_subscription_id_unique";
