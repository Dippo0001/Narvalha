/*
  # Stripe Integration Fields

  1. Changes
    - Add `stripe_customer_id` and `stripe_subscription_id` to `barbershops`
    - Update `subscription_status` to match Stripe statuses more closely if needed
*/

ALTER TABLE barbershops
ADD COLUMN IF NOT EXISTS stripe_customer_id text,
ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

-- Index for faster lookups during webhooks
CREATE INDEX IF NOT EXISTS idx_barbershops_stripe_customer_id ON barbershops(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_barbershops_stripe_subscription_id ON barbershops(stripe_subscription_id);
