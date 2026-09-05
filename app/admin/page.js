const SECTIONS = [
  {
    href: "/admin/finanzas",
    title: "Finanzas (fabricante)",
    description: "Saldo pendiente al fabricante y botón para marcarlo como pagado.",
    icon: "💰",
  },
  {
    href: "/admin/crm",
    title: "CRM",
    description: "Datos de contacto y compra de cada pedido confirmado.",
    icon: "📇",
  },
  {
    href: "/admin/referidos",
    title: "Referidos",
    description: "Comisiones pendientes de los embajadores — marcar como pagadas.",
    icon: "🤝",
  },
  {
    href: "/admin/regalos",
    title: "Códigos de regalo",
    description: "Genera códigos de 100% de descuento (40x50) para influencers.",
    icon: "🎁",
  },
  {
    href: "/admin/reporte",
    title: "Reporte financiero",
    description: "Ingresos, costos, comisiones y utilidad neta por período.",
    icon: "📊",
  },
];

export default function AdminHubPage() {
  return (
    <div className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12 sm:px-6 sm:py-16">
      <div>
        <h1 className="font-heading text-xl font-bold tracking-tight sm:text-2xl">Admin — Mystery</h1>
        <p className="mt-1 text-sm text-[#33456b]">Panel de control interno.</p>
      </div>

      <div className="flex flex-col gap-3">
        {SECTIONS.map((s) => (
          <a
            key={s.href}
            href={s.href}
            className="flex items-center gap-4 rounded-2xl border border-black/5 bg-[#fffaf0] p-5 shadow-[0_10px_25px_-14px_rgba(30,20,60,0.3)] transition-colors hover:border-accent/40"
          >
            <span className="text-2xl" aria-hidden="true">
              {s.icon}
            </span>
            <div>
              <p className="font-semibold text-[#1b2a4a]">{s.title}</p>
              <p className="mt-0.5 text-sm text-[#33456b]">{s.description}</p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
