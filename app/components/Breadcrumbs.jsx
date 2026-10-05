import Link from "next/link";

// Migas de pan visibles (oct 2026) — mismo arreglo de items que se pasa a
// breadcrumbJsonLd (app/lib/structuredData.js), así lo que ve el usuario y
// lo que lee Google siempre coinciden. El último item es la página actual
// (sin link).
export default function Breadcrumbs({ items }) {
  return (
    <nav aria-label="Migas de pan" className="text-xs text-[#33456b] sm:text-sm">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={item.path} className="flex items-center gap-1.5">
              {isLast ? (
                <span aria-current="page" className="font-medium text-[#1b2a4a]">
                  {item.name}
                </span>
              ) : (
                <>
                  <Link href={item.path} className="underline-offset-4 hover:text-[#1b2a4a] hover:underline">
                    {item.name}
                  </Link>
                  <span aria-hidden="true">/</span>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
