import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Next lit .env.local tout seul, mais drizzle-kit tourne hors de Next : on le charge nous-mêmes.
config({ path: ".env.local", quiet: true });

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts", // où sont décrites nos tables
  out: "./drizzle", // où ranger les fichiers de migration (SQL), commités dans le dépôt
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
