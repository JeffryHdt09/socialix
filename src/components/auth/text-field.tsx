import type { ComponentProps } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type TextFieldProps = ComponentProps<typeof Input> & { label: string; name: string };

// Un champ avec son libellé. Le htmlFor du libellé pointe vers l'id du champ : un clic sur le libellé
// place le curseur dans le champ, et les lecteurs d'écran annoncent le libellé.
export function TextField({ label, name, ...props }: TextFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...props} />
    </div>
  );
}
