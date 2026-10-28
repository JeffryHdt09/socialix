import { serve } from "inngest/next";

import { inngest } from "@/inngest/client";
import { functions } from "@/inngest/functions";

// Le point d'entrée qu'Inngest rappelle pour exécuter nos fonctions. En production, Inngest signe chaque appel avec
// INNGEST_SIGNING_KEY et le SDK refuse ceux qui ne sont pas signés ; en local, le serveur de dev (npx inngest-cli dev) vient
// le découvrir tout seul sur http://localhost:3000/api/inngest.
export const { GET, POST, PUT } = serve({ client: inngest, functions });
