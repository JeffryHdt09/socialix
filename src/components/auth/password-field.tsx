"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <div className="flex flex-col gap-2">
      <Label htmlFor="password">Mot de passe</Label>
      <div className="relative">
        <Input
          id="password"
          name="password"
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required
          maxLength={PASSWORD_MAX_LENGTH}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={showRules ? "password-rules" : undefined}
          className="pr-28"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          className="absolute top-1/2 right-1 -translate-y-1/2 text-[13px] text-muted-foreground"
        >
          {visible ? "Masquer" : "Afficher"}
        </Button>
      </div>

      {showRules && (
        <ul id="password-rules" className="mt-1 grid gap-1 text-[13px]">
          {passwordRules.map((rule) => {
            const ok = rule.test(value);
            return (
              <li key={rule.id} className={`flex items-center gap-2 ${ok ? "text-foreground" : "text-muted-foreground"}`}>
                {/* L'état ne repose pas sur la couleur seule : case cochée ou vide, et texte pour les lecteurs d'écran. */}
                <span
                  aria-hidden="true"
                  className={`grid size-4 place-items-center rounded-[4px] border ${ok ? "border-success bg-success text-card" : "border-border"}`}
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
