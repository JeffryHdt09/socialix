-- Supabase expose automatiquement les tables du schéma public via sa Data API.
-- On ne l'utilise pas : on active RLS sans aucune règle, ce qui ferme cette porte.
-- Notre serveur se connecte en propriétaire des tables et n'est pas concerné par RLS.
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "session" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "account" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "verification" ENABLE ROW LEVEL SECURITY;
