import Link from "next/link";

// Chips de enlaces internos (oct 2026) — categorías relacionadas y
// landings de /cuadros/*, usados en /categoria/[slug] y /producto/[id]
// para que Google (y el visitante) pasen de una página a otra sin volver
// al Home.
export default function RelatedLinks({ title, links }) {
  if (!links.length) return null;
  return (
    <nav aria-label={title} className="rounded-2xl border border-black/5 bg-[#fffaf0] p-5 shadow-[0_10px_25px_-14px_rgba(30,20,60,0.3)]">
      <h2 className="font-heading mb-3 text-base font-bold sm:text-lg">{title}</h2>
      <ul className="flex flex-wrap gap-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="inline-block rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-[#33456b] hover:border-accent hover:text-[#1b2a4a] sm:text-sm"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
