import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import TopBar from "../components/layout/TopBar";
import CategoryTag from "../components/ui/CategoryTag";
import { useUsers } from "../context/UsersContext";

const STATUS_COLOR = {
  Activo: "green",
  Invitado: "yellow",
};

const STATUS_FILTERS = ["Todos", "Activo", "Invitado"];

export default function UsuariosPage() {
  const { users } = useUsers();
  const [status, setStatus] = useState("Todos");

  const filtered = useMemo(
    () => (status === "Todos" ? users : users.filter((u) => u.status === status)),
    [status, users]
  );

  const statusCounts = useMemo(
    () => ({
      activos: users.filter((u) => u.status === "Activo").length,
      invitados: users.filter((u) => u.status === "Invitado").length,
    }),
    [users]
  );

  const regions = useMemo(() => {
    const counts = new Map();
    for (const user of users) {
      counts.set(user.region, (counts.get(user.region) ?? 0) + 1);
    }
    return Array.from(counts, ([region, count]) => ({ region, count }));
  }, [users]);

  return (
    <>
      <TopBar
        title="Usuarios"
        subtitle="Equipo con acceso al panel de decisión de crédito de Cebix."
        actions={
          <Link
            to="/signup"
            className="bg-accent-500 px-3 py-2 text-sm font-medium text-accent-contrast shadow-sm hover:bg-accent-600"
          >
            Crear usuario
          </Link>
        }
      />

      <div className="mt-6 h-px w-full bg-gray-200 dark:bg-gray-700" aria-hidden="true" />

      <div className="grid grid-cols-1 px-4 py-6 sm:px-6 lg:px-8 lg:grid-cols-[280px_1px_1fr] lg:gap-8">
        {/* Rail izquierdo: filtro por estado y cobertura por región */}
        <aside className="bg-white dark:bg-black">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Estado</h2>
          <div className="mt-3 flex flex-col gap-1.5">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={[
                  " px-3 py-2 text-left text-sm font-medium transition-colors",
                  status === s
                    ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white"
                    : "text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800/60",
                ].join(" ")}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="mt-5 h-px w-full bg-gray-200 dark:bg-gray-700" aria-hidden="true" />

          <dl className="mt-5 space-y-2.5 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Total de usuarios</dt>
              <dd className="font-sora font-bold text-gray-900 dark:text-gray-100">{users.length}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Activos</dt>
              <dd className="font-sora font-bold text-gray-900 dark:text-gray-100">
                {statusCounts.activos}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Invitados</dt>
              <dd className="font-sora font-bold text-gray-900 dark:text-gray-100">
                {statusCounts.invitados}
              </dd>
            </div>
          </dl>

          <div className="mt-5 h-px w-full bg-gray-200 dark:bg-gray-700" aria-hidden="true" />

          <h3 className="mt-5 text-sm font-semibold text-gray-900 dark:text-gray-100">Por región</h3>
          <dl className="mt-3 space-y-2.5 text-sm">
            {regions.map((r) => (
              <div key={r.region} className="flex items-center justify-between">
                <dt className="text-gray-500 dark:text-gray-400">{r.region}</dt>
                <dd className="font-sora font-bold text-gray-900 dark:text-gray-100">{r.count}</dd>
              </div>
            ))}
          </dl>
        </aside>

        <div className="hidden bg-gray-200 dark:bg-gray-700 lg:block" aria-hidden="true" />

        {/* Contenido principal: tabla de usuarios */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 text-xs font-medium text-gray-400 dark:text-gray-500">
                <th className="pb-2 pr-4 font-medium">Usuario</th>
                <th className="pb-2 pr-4 font-medium">Rol</th>
                <th className="pb-2 pr-4 font-medium">Región</th>
                <th className="pb-2 pr-4 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr key={user.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={user.avatar}
                        alt={user.name}
                        loading="lazy"
                        decoding="async"
                        className="h-9 w-9 shrink-0 rounded-full object-cover"
                      />
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{user.name}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-sm text-gray-700 dark:text-gray-300">{user.role}</td>
                  <td className="py-3 pr-4 text-sm text-gray-700 dark:text-gray-300">{user.region}</td>
                  <td className="py-3 pr-4">
                    <CategoryTag label={user.status} color={STATUS_COLOR[user.status] ?? "gray"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </>
  );
}
