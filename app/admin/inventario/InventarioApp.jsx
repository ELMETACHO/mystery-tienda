"use client";

import InventoryPanel from "../../components/InventoryPanel";

export default function InventarioApp() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-12 sm:px-6">
      <div>
        <a href="/admin" className="text-sm text-accent underline underline-offset-2">← Admin</a>
        <h1 className="mt-2 font-heading text-xl font-bold tracking-tight sm:text-2xl">Inventario</h1>
      </div>
      <InventoryPanel />
    </div>
  );
}
