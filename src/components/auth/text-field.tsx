import type { InputHTMLAttributes } from "react";

// Styles communs des champs (DESIGN.md : arrondi 10 px, filet fin, 44 px de haut minimum).
export const inputClass =
  "h-11 w-full rounded-[10px] border border-filet bg-surface-2 px-3 text-[15px] text-encre placeholder:text-secondaire focus-visible:border-encre";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; name: string };

// Un champ avec son libellé. Le <label htmlFor> relie les deux : un clic sur le libellé
// place le curseur dans le champ, et les lecteurs d'écran annoncent le libellé.
export function TextField({ label, name, ...props }: TextFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-[13px] font-medium text-encre">
        {label}
      </label>
      <input id={name} name={name} className={inputClass} {...props} />
    </div>
  );
}
