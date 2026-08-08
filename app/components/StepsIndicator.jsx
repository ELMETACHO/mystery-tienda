"use client";

import { AnimatePresence, motion } from "motion/react";

// Mismo componente visual que /crear (círculo con número → checkmark
// animado al completarse, conector que se "llena"), extraído para poder
// reutilizarlo en /estudio sin duplicar la lógica de motion/react.
function StepIndicator({ stepNumber, isDone, isCurrent }) {
  return (
    <span
      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition-colors sm:h-7 sm:w-7 ${
        isDone
          ? "bg-accent text-white"
          : isCurrent
          ? "border-2 border-accent text-accent-soft"
          : "border border-white/15 text-zinc-500"
      }`}
    >
      <AnimatePresence mode="wait" initial={false}>
        {isDone ? (
          <motion.svg
            key="check"
            viewBox="0 0 24 24"
            fill="none"
            className="h-3.5 w-3.5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <motion.path
              d="M5 13l4 4L19 7"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.35, ease: "easeInOut", delay: 0.1 }}
            />
          </motion.svg>
        ) : (
          <motion.span
            key="number"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {stepNumber}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

function StepConnector({ isDone }) {
  return (
    <span className="relative mx-2 mb-4 h-px flex-1 overflow-hidden bg-white/10 sm:mx-3">
      <motion.span
        className="absolute inset-0 origin-left bg-accent"
        initial={false}
        animate={{ scaleX: isDone ? 1 : 0 }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
      />
    </span>
  );
}

export default function StepsIndicator({ steps, current }) {
  return (
    <ol className="mx-auto mb-4 flex w-full max-w-md items-center sm:mb-6">
      {steps.map((step, i) => {
        const stepNumber = i + 1;
        const isDone = stepNumber < current;
        const isCurrent = stepNumber === current;
        return (
          <li key={step} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <StepIndicator stepNumber={stepNumber} isDone={isDone} isCurrent={isCurrent} />
              <span
                className={`whitespace-nowrap text-[11px] sm:text-xs ${
                  isCurrent ? "font-medium text-zinc-200" : "text-zinc-500"
                }`}
              >
                {step}
              </span>
            </div>
            {stepNumber !== steps.length && <StepConnector isDone={isDone} />}
          </li>
        );
      })}
    </ol>
  );
}
