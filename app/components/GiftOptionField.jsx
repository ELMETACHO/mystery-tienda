"use client";

import { GIFT_MESSAGE_MAX } from "../lib/giftFeatures";

// "🎁 Es un regalo" en /checkout (solo con NEXT_PUBLIC_GIFT_FEATURES=1).
// Puro estado local: ningún request, ningún cálculo — no suma demora.
// El mensaje se imprime en una tarjeta y el paquete va sin precio (ver
// giftOptionNote en app/lib/email.js).
export default function GiftOptionField({ value, onChange, inputClassName = "" }) {
  return (
    <div className="border-t border-black/10 pt-3">
      <label htmlFor="gift-option" className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-[#1b2a4a]">
        <input
          id="gift-option"
          type="checkbox"
          checked={value.enabled}
          onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
          className="h-4 w-4 accent-accent"
        />
        🎁 Es un regalo <span className="font-normal text-[#5b6b8c]">(sin precio en el paquete)</span>
      </label>
      {value.enabled && (
        <div className="mt-2 flex flex-col gap-1">
          <label htmlFor="gift-message" className="text-xs text-[#33456b]">
            Mensaje impreso en una tarjeta (opcional)
          </label>
          <textarea
            id="gift-message"
            rows={3}
            maxLength={GIFT_MESSAGE_MAX}
            value={value.message}
            onChange={(e) => onChange({ ...value, message: e.target.value })}
            placeholder="¡Feliz cumpleaños, mamá! Te quiero mucho."
            className={`${inputClassName} text-sm`}
          />
          <span className="self-end text-xs text-[#5b6b8c]">
            {value.message.length}/{GIFT_MESSAGE_MAX}
          </span>
        </div>
      )}
    </div>
  );
}
