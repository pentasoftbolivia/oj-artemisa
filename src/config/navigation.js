export const DEFAULT_NAV_ITEMS = [
  {
    title: "Configuración",
    href: "#",
    adminOnly: true,
    submenu: [
      { title: "Ambientes", href: "/ambientes" },
      { title: "Ciudades", href: "/ciudades" },
      { title: "Inmuebles", href: "/inmuebles" },
      { title: "Niveles", href: "/niveles" },
      { title: "Rubros", href: "/rubros" },
      { title: "Tipos de Rubro", href: "/tiporubro" },
    ],
  },
  { title: "Activos fijos", href: "/activos", adminOnly: true },
  { title: "Responsables", href: "/responsables", adminOnly: true },
  { title: "Inventario", href: "/inventario" },
  { title: "Asignaciones", href: "/asignaciones" },
/*   { title: "Movimientos", href: "/movimientos" }, */
/*   { title: "Revaluo", href: "/" }, */
];