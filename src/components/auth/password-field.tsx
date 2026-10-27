"use client";

import { useState } from "react";

import { inputClass } from "@/components/auth/text-field";
import { PASSWORD_MAX_LENGTH, passwordRules } from "@/lib/password-rules";

type PasswordFieldProps = {
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  showRules?: boolean; // à l'inscription : liste des règles cochées en direct
};

export function PasswordField({ value, onChange, autoComplete, showRules = false }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="password" className="text-[13px] font-medium text-encre">
        Mot de passe
      </label>
      <div className="relative">
        <input
          id="password"
          name="password"
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required
          maxLength={PASSWORD_MAX_LENGTH}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={showRules ? "password-rules" : undefined}
          className={`${inputClass} pr-24`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          className="absolute inset-y-0 right-0 min-w-11 rounded-r-[10px] px-3 text-[13px] font-medium text-secondaire hover:text-encre"
        >
          {visible ? "Masquer" : "Afficher"}
        </button>
      </div>

      {showRules && (
        <ul id="password-rules" className="mt-1 grid gap-1 text-[13px]">
          {passwordRules.map((rule) => {
            const ok = rule.test(value);
            return (
              <li key={rule.id} className={`flex items-center gap-2 ${ok ? "text-encre" : "text-secondaire"}`}>
                {/* L'état ne repose pas sur la couleur seule : case cochée ou vide, et texte pour les lecteurs d'écran. */}
                <span
                  aria-hidden="true"
                  className={`grid size-4 place-items-center rounded-[4px] border ${ok ? "border-succes bg-succes text-surface" : "border-filet"}`}
                >
                  {ok && (
                    <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2.5 6.5 5 9l4.5-6" />
                    </svg>
                  )}
                </span>
                {rule.label}
                <span className="sr-only">{ok ? " : respecté" : " : pas encore respecté"}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
