import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

/**
 * Esqueletos con shimmer (react-loading-skeleton), uno POR PANTALLA con la forma de lo que realmente muestra:
 * columnas, tarjetas, gráficas, tabla, mapa, formularios… Los colores salen de index.css (.app-skeleton).
 *
 *   <RouteSkeleton page="parcelas" />   barra superior fantasma + cuerpo (mientras baja el código de la pantalla)
 *   <PageBodySkeleton page="parcelas" /> solo el cuerpo (cuando la barra superior real ya se pinta)
 *   <FullScreenSkeleton />               sidebar fantasma + cuerpo (verificando sesión)
 *
 * `page` = clave de pantalla: dashboard | parcelas | historial | detalle | modelo | mapa | predicciones | satelite |
 *                              shap | ajustes | perfil | acerca
 */

// ───────────────────────────── Primitivas ─────────────────────────────

/** Barra/bloque con shimmer. `strong` = tono más marcado (títulos, cifras). */
function B({ h = 12, w = "100%", r = 6, strong = false, circle = false, className = "" }) {
  return (
    <Skeleton
      height={h}
      width={w}
      borderRadius={r}
      circle={circle}
      containerClassName={`block ${strong ? "strong" : ""} ${className}`}
    />
  );
}

const Panel = ({ children, className = "" }) => (
  <div className={`overflow-hidden rounded-2xl border border-gray-200 p-5 dark:border-gray-800 ${className}`}>{children}</div>
);

/** Título de sección + descripción opcional. */
const Head = ({ w = 150, desc = 0 }) => (
  <div className="mb-3">
    <B h={16} w={w} strong />
    {desc ? <B h={11} w={desc} className="mt-2" /> : null}
  </div>
);

/** Filas "etiqueta … valor" (fichas de datos). */
const KV = ({ rows = 5, className = "" }) => (
  <div className={`divide-y divide-gray-100 dark:divide-gray-800/70 ${className}`}>
    {Array.from({ length: rows }, (_, i) => (
      <div key={i} className="flex items-center justify-between gap-4 py-3">
        <B h={11} w={70 + ((i * 23) % 40)} />
        <B h={12} w={60 + ((i * 31) % 50)} strong />
      </div>
    ))}
  </div>
);

/** Barras horizontales con etiqueta (importancia de variables, regiones). */
const HBars = ({ rows = 6, labelW = 110 }) => (
  <div className="space-y-3.5">
    {Array.from({ length: rows }, (_, i) => (
      <div key={i} className="flex items-center gap-3">
        <B h={11} w={labelW - ((i * 9) % 30)} />
        <B h={10} w={`${88 - i * 11}%`} r={3} className="flex-1" />
      </div>
    ))}
  </div>
);

const Chart = ({ h = 240, className = "" }) => <B h={h} r={16} className={className} />;

const Pills = ({ n = 4, w = 78 }) => (
  <div className="flex flex-wrap gap-2">
    {Array.from({ length: n }, (_, i) => (
      <B key={i} h={32} w={w + ((i * 13) % 24)} r={999} />
    ))}
  </div>
);

/** Tabla con columnas de distinto ancho; `cols` describe cada una. */
export function TableSkeleton({ rows = 6, cols = [32, 150, 80, 100, "flex"], className = "" }) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 ${className}`}>
      <div className="flex items-center gap-4 border-b border-gray-200 px-4 py-3 dark:border-gray-800">
        {cols.map((c, i) => (
          <B key={i} h={9} w={c === "flex" ? "100%" : Math.max(28, Math.round(c * 0.6))} className={c === "flex" ? "hidden flex-1 sm:block" : i >= 3 ? "hidden sm:block" : ""} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-gray-100 px-4 py-3.5 last:border-b-0 dark:border-gray-800/70">
          {cols.map((c, j) => (
            <B key={j} h={j === 0 ? 14 : 12} w={c === "flex" ? "100%" : c} strong={j === 1} className={c === "flex" ? "hidden flex-1 sm:block" : j >= 3 ? "hidden sm:block" : ""} />
          ))}
        </div>
      ))}
    </div>
  );
}

const Pager = () => (
  <div className="mt-4 flex items-center justify-between">
    <B h={11} w={120} />
    <div className="flex gap-2">
      <B h={32} w={32} r={8} />
      <B h={32} w={32} r={8} />
      <B h={32} w={32} r={8} />
    </div>
  </div>
);

export function LinesSkeleton({ lines = 3, className = "" }) {
  return (
    <div className={className}>
      {Array.from({ length: lines }, (_, i) => (
        <B key={i} h={12} w={i === lines - 1 ? "60%" : "100%"} className="mb-2.5" />
      ))}
    </div>
  );
}

export function BlockSkeleton({ height = 240, className = "", rounded = true }) {
  // height puede ser un número o "100%": en ese caso el contenedor padre debe tener altura definida.
  return <Skeleton height={height} borderRadius={rounded ? 16 : 0} containerClassName={`block h-full w-full ${className}`} />;
}

const PAD = "px-4 sm:px-6 lg:px-8";

// ───────────────────────────── Barra superior ─────────────────────────────

/** Título + subtítulo + acciones (misma estructura que <TopBar>). */
function TopBarSkeleton({ title = 200, subtitle = 320, actions = [], search = false }) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-4 pt-4 sm:pt-6 ${PAD}`}>
      <div className="min-w-0">
        <B h={24} w={title} strong />
        <B h={12} w={subtitle} className="mt-2 max-w-full" />
      </div>
      <div className="flex items-center gap-2">
        {search && <B h={38} w={220} r={999} className="hidden md:block" />}
        {actions.map((w, i) => (
          <B key={i} h={36} w={w} r={999} />
        ))}
      </div>
    </div>
  );
}

// ───────────────────────────── Cuerpos por pantalla ─────────────────────────────

/** Resumen general: resumen del modelo (columna) + distribución + tabla de parcelas evaluadas. */
function DashboardBody() {
  return (
    <div className={`mt-6 grid grid-cols-1 items-start gap-10 py-6 lg:grid-cols-[280px_1fr] ${PAD}`}>
      <section>
        <Head w={140} />
        <B h={120} w={120} r={16} className="mb-4" />
        <Pills n={3} w={64} />
        <KV rows={4} className="mt-3" />
        <div className="mt-8">
          <Head w={170} />
          <HBars rows={5} labelW={80} />
        </div>
      </section>
      <div className="min-w-0 space-y-10">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <B h={16} w={190} strong />
            <B h={20} w={20} r={4} />
          </div>
          <Chart h={260} />
        </section>
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <B h={16} w={150} strong />
            <div className="flex gap-2">
              <B h={36} w={96} r={8} />
              <B h={36} w={140} r={8} />
            </div>
          </div>
          <TableSkeleton rows={6} cols={[28, 120, 90, 80, 90, "flex"]} />
          <Pager />
        </section>
      </div>
    </div>
  );
}

/** Parcelas: filtros por región y elegibilidad + registrar | mapa + listado. */
function ParcelasBody() {
  return (
    <div className={`mt-6 grid grid-cols-1 items-start gap-10 py-6 lg:grid-cols-[280px_1fr] ${PAD}`}>
      <aside className="min-w-0 space-y-10">
        <Panel>
          <Head w={130} desc={190} />
          <div className="space-y-3.5 pt-1">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex items-center justify-between">
                <B h={12} w={70 + ((i * 17) % 50)} />
                <B h={12} w={22} />
              </div>
            ))}
          </div>
        </Panel>
        <Panel>
          <Head w={100} />
          <B h={6} r={2} className="mb-4" />
          <div className="space-y-3.5">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <B h={8} w={8} r={2} />
                <B h={12} w={90} className="flex-1" />
                <B h={12} w={26} />
                <B h={12} w={22} />
              </div>
            ))}
          </div>
        </Panel>
        <section>
          <Head w={170} desc={230} />
          <B h={150} r={16} />
        </section>
      </aside>
      <div className="min-w-0 space-y-10">
        <Chart h={340} />
        <section>
          <div className="mb-3 flex items-center justify-between">
            <B h={16} w={140} strong />
            <B h={14} w={90} />
          </div>
          <TableSkeleton rows={7} cols={[28, 130, 90, 80, 80, "flex"]} />
          <Pager />
        </section>
      </div>
    </div>
  );
}

/** Historial: búsqueda + filtro de región + lista con casillas y paginación. */
function HistorialBody() {
  return (
    <div className={`mt-6 space-y-4 py-6 ${PAD}`}>
      <div className="flex flex-wrap items-center gap-3">
        <B h={40} r={999} className="min-w-[220px] flex-1" />
        <B h={40} w={150} r={999} />
        <B h={40} w={120} r={999} />
      </div>
      <TableSkeleton rows={10} cols={[20, 170, 110, 80, 60, "flex", 28]} />
      <Pager />
    </div>
  );
}

/** Detalle de parcela: cifras, semáforo, rendimiento + rango, SHAP local, variables | ficha. */
function DetalleBody() {
  return (
    <div className={`mt-6 space-y-10 py-6 ${PAD}`}>
      <div className="grid grid-cols-1 gap-10 xl:grid-cols-[minmax(0,1fr)_230px_360px]">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i}>
              <B h={10} w={70} />
              <B h={26} w={90} className="mt-2" strong />
            </div>
          ))}
        </div>
        <B h={56} r={12} />
        <B h={56} r={12} />
      </div>
      <div className="grid grid-cols-1 items-start gap-10 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-10">
          <section>
            <B h={10} w={140} />
            <B h={44} w={190} className="mt-3" strong />
            <B h={12} r={999} className="mt-5" />
          </section>
          <section>
            <B h={10} w={250} className="mb-4" />
            <HBars rows={8} labelW={150} />
          </section>
          <section>
            <B h={10} w={230} className="mb-4" />
            <TableSkeleton rows={5} cols={[160, 90, 90, "flex"]} />
          </section>
        </div>
        <section>
          <B h={10} w={110} className="mb-2" />
          <KV rows={6} />
          <B h={40} r={999} className="mt-5" />
        </section>
      </div>
    </div>
  );
}

/** Modelo: pestañas, KPIs en rejilla unida y tarjetas con gráfica y detalle. */
function ModeloBody({ tabs = true }) {
  return (
    <div className={`mt-6 space-y-6 py-6 ${PAD}`}>
      {tabs && (
        <div className="flex gap-6 border-b border-gray-200 pb-3 dark:border-gray-800">
          {[70, 70, 60, 80].map((w, i) => (
            <B key={i} h={14} w={w} />
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 divide-x divide-y divide-gray-200 overflow-hidden rounded-2xl border border-gray-200 dark:divide-gray-800 dark:border-gray-800 lg:grid-cols-4 lg:divide-y-0">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="p-5">
            <B h={10} w={110} />
            <B h={30} w={i === 0 ? 150 : 80} className="mt-3" strong />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Panel>
          <Head w={220} desc={300} />
          <Chart h={260} />
        </Panel>
        <Panel>
          <Head w={160} />
          <HBars rows={6} labelW={100} />
        </Panel>
      </div>
    </div>
  );
}

/** Predicciones: selector, semáforo y datos (columna) | predicción, contribuciones, ubicación + ficha, tabla regional. */
function PrediccionesBody() {
  return (
    <div className={`mt-6 grid grid-cols-1 items-start gap-12 py-8 lg:grid-cols-[280px_1fr] lg:gap-14 ${PAD}`}>
      <aside className="min-w-0 space-y-10">
        <section>
          <Head w={150} desc={210} />
          <B h={42} r={999} />
        </section>
        <section>
          <Head w={90} />
          <div className="flex items-center gap-3">
            <B circle h={44} w={44} />
            <div className="flex-1">
              <B h={13} w={110} strong />
              <B h={10} w={150} className="mt-2" />
            </div>
          </div>
        </section>
        <section>
          <Head w={130} />
          <KV rows={4} />
          <B h={40} r={999} className="mt-4" />
        </section>
      </aside>
      <div className="min-w-0 space-y-10">
        <section>
          <B h={10} w={80} />
          <B h={22} w={220} className="mt-2" strong />
          <B h={50} w={200} className="mt-5" strong />
          <B h={12} r={999} className="mt-5" />
        </section>
        <section>
          <B h={10} w={190} className="mb-4" />
          <HBars rows={8} labelW={150} />
        </section>
        <section className="grid grid-cols-1 gap-x-10 gap-y-8 md:grid-cols-2">
          <div>
            <B h={10} w={80} className="mb-3" />
            <Chart h={260} />
          </div>
          <div>
            <B h={10} w={100} className="mb-2" />
            <KV rows={5} />
          </div>
        </section>
        <section>
          <B h={10} w={260} className="mb-3" />
          <TableSkeleton rows={5} cols={[160, 90, 90, "flex"]} />
        </section>
      </div>
    </div>
  );
}

/** Parcela satelital: pestañas + mapa de dibujo | panel de 3 pasos (contorno, datos, predicción). */
function SateliteBody() {
  return (
    <div className={`mt-6 space-y-5 py-6 ${PAD}`}>
      <div className="flex gap-6 border-b border-gray-200 pb-3 dark:border-gray-800">
        <B h={14} w={110} />
        <B h={14} w={130} />
      </div>
      <div className="grid grid-cols-1 overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-h-[360px] p-3 lg:min-h-[560px]">
          <BlockSkeleton height="100%" />
        </div>
        <aside className="divide-y divide-gray-200 border-t border-gray-200 dark:divide-gray-800 dark:border-gray-800 lg:border-l lg:border-t-0">
          {[
            <>
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map((i) => (
                  <B key={i} h={50} r={10} />
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <B h={32} w={120} r={8} />
                <B h={32} w={130} r={8} />
              </div>
            </>,
            <>
              <B h={10} w={110} />
              <B h={38} r={8} className="mt-2" />
              <div className="mt-3 grid grid-cols-2 gap-3">
                <B h={38} r={8} />
                <B h={38} r={8} />
              </div>
            </>,
            <B h={44} r={999} />,
          ].map((content, i) => (
            <section key={i} className="px-5 py-5">
              <div className="mb-4 flex items-center gap-2.5">
                <B circle h={22} w={22} />
                <B h={14} w={[150, 120, 100][i]} strong />
              </div>
              {content}
            </section>
          ))}
        </aside>
      </div>
      <div className="grid gap-px overflow-hidden rounded-lg sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <B key={i} h={56} r={8} />
        ))}
      </div>
    </div>
  );
}

/** Validación SHAP: foto de portada, encabezado con 3 cifras, resumen, importancia/consistencia, imágenes, datos. */
function ShapBody() {
  return (
    <div className={`mt-6 space-y-10 py-6 ${PAD}`}>
      <div className="pt-6 lg:pt-12">
        <B h={44} w={380} strong />
        <B h={12} w={520} className="mt-3 max-w-full" />
        <div className="mt-10 grid max-w-5xl gap-6 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <B h={10} w={110} />
              <B h={28} w={100} className="mt-2" strong />
            </div>
          ))}
        </div>
      </div>
      <Chart h={200} />
      <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="p-5">
            <B h={10} w={90} />
            <B h={26} w={70} className="mt-3" strong />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel>
          <Head w={190} desc={260} />
          <div className="space-y-3.5">
            {Array.from({ length: 10 }, (_, i) => (
              <div key={i} className="grid grid-cols-[minmax(0,1fr)_30%_3rem] items-center gap-x-4">
                <B h={11} w={150 - ((i * 7) % 40)} />
                <B h={9} w={`${95 - i * 8}%`} r={3} />
                <B h={11} w={36} />
              </div>
            ))}
          </div>
        </Panel>
        <div className="space-y-6">
          <Panel>
            <Head w={150} />
            <Chart h={110} />
          </Panel>
          <Panel>
            <Head w={170} />
            <HBars rows={3} labelW={90} />
          </Panel>
        </div>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <Chart h={220} />
        <Chart h={220} />
      </div>
    </div>
  );
}

/** Ajustes: secciones (apariencia con 3 vistas previas, idioma/color, notificaciones con interruptores). */
function AjustesBody() {
  const Section = ({ children }) => (
    <section className="mb-8 overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
      <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800/70">
        <B h={32} w={32} r={8} />
        <div>
          <B h={14} w={110} strong />
          <B h={10} w={230} className="mt-2" />
        </div>
      </div>
      {children}
    </section>
  );
  return (
    <div className={`mt-8 max-w-4xl sm:mt-10 ${PAD}`}>
      <Section>
        <div className="grid grid-cols-1 divide-y divide-gray-200 dark:divide-gray-800 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[0, 1, 2].map((i) => (
            <div key={i} className="p-5">
              <B h={96} r={10} />
              <B h={12} w={70} className="mt-3" strong />
              <B h={10} w={120} className="mt-2" />
            </div>
          ))}
        </div>
      </Section>
      <Section>
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <B h={10} w={80} />
              <B h={38} r={8} className="mt-2" />
            </div>
          ))}
        </div>
      </Section>
      <Section>
        <div className="divide-y divide-gray-100 px-5 dark:divide-gray-800/70">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between py-4">
              <div>
                <B h={12} w={150} strong />
                <B h={10} w={250} className="mt-2" />
              </div>
              <B h={22} w={40} r={999} />
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

/** Perfil: identidad (avatar, nombre, correo, fecha, 3 cifras) y seguridad. */
function PerfilBody() {
  return (
    <div className={`mt-8 max-w-4xl space-y-8 sm:mt-10 ${PAD}`}>
      <Panel className="!p-0">
        <div className="flex items-center gap-5 p-5">
          <B circle h={80} w={80} />
          <div className="flex-1">
            <B h={20} w={200} strong />
            <B h={11} w={240} className="mt-3" />
            <B h={11} w={180} className="mt-2" />
          </div>
          <B h={36} w={100} r={999} />
        </div>
        <div className="grid grid-cols-3 divide-x divide-gray-200 border-t border-gray-200 py-5 dark:divide-gray-800 dark:border-gray-800">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <B h={24} w={50} strong />
              <B h={10} w={80} />
            </div>
          ))}
        </div>
      </Panel>
      <Panel>
        <Head w={100} desc={200} />
        <div className="flex items-center justify-between pt-2">
          <B h={12} w={160} />
          <B h={36} w={160} r={999} />
        </div>
      </Panel>
    </div>
  );
}

/** Cebada y FIRA: portada, encabezado con 3 datos, calendario fenológico, tarjetas con texto e imágenes | info rápida. */
function AcercaBody() {
  return (
    <div className={`mt-6 py-6 ${PAD}`}>
      <div className="pb-6 pt-8 lg:pt-14">
        <B h={48} w={420} strong />
        <B h={12} w={560} className="mt-3 max-w-full" />
        <div className="mt-8 grid max-w-4xl gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <B key={i} h={36} r={8} />
          ))}
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-start">
        <div className="min-w-0 space-y-6">
          <Panel>
            <Head w={200} />
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 28 }, (_, i) => (
                <B key={i} h={22} r={4} />
              ))}
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i}>
                  <B h={150} r={12} />
                  <B h={12} w={110} className="mt-3" strong />
                  <LinesSkeleton lines={2} className="mt-2" />
                </div>
              ))}
            </div>
          </Panel>
          <Panel>
            <Head w={260} desc={140} />
            <LinesSkeleton lines={4} />
          </Panel>
          <Panel>
            <Head w={150} desc={110} />
            <div className="grid gap-4 md:grid-cols-5">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i}>
                  <B h={30} w={30} r={8} />
                  <B h={12} w={90} className="mt-3" strong />
                  <B h={10} className="mt-2" />
                </div>
              ))}
            </div>
          </Panel>
        </div>
        <aside className="space-y-6">
          <Panel>
            <Head w={130} />
            <KV rows={4} />
          </Panel>
          <Panel>
            <Head w={110} />
            <B h={90} r={12} />
          </Panel>
        </aside>
      </div>
    </div>
  );
}

/** Mapa satelital: mapa oscuro a pantalla completa con título, filtro de región y columna de tarjetas a la derecha. */
function MapaSkeleton() {
  return (
    <div className="dark-skeleton relative h-full min-h-screen w-full bg-black">
      <div className="absolute left-4 top-4 sm:left-8 sm:top-6">
        <B h={24} w={190} strong />
        <B h={12} w={240} className="mt-2" />
      </div>
      <div className="absolute inset-x-4 bottom-6 sm:left-8 lg:right-[390px]">
        <Pills n={4} w={86} />
      </div>
      <div className="absolute right-5 top-3 hidden w-[352px] space-y-3 lg:block">
        <B h={120} r={14} />
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <B key={i} h={70} r={12} />
          ))}
        </div>
        <B h={200} r={14} />
      </div>
    </div>
  );
}

// ───────────────────────────── Tabla de pantallas ─────────────────────────────

const PAGES = {
  dashboard: { Body: DashboardBody, bar: { title: 190, subtitle: 300, search: true } },
  parcelas: { Body: ParcelasBody, bar: { title: 110, subtitle: 190, actions: [96, 150], search: true } },
  historial: { Body: HistorialBody, bar: { title: 200, subtitle: 130, actions: [150] } },
  detalle: { Body: DetalleBody, bar: { title: 200, subtitle: 260, actions: [120, 90], search: true } },
  modelo: { Body: ModeloBody, bar: { title: 90, subtitle: 280, actions: [36], search: true } },
  predicciones: { Body: PrediccionesBody, bar: { title: 140, subtitle: 340, actions: [36] } },
  satelite: { Body: SateliteBody, bar: { title: 170, subtitle: 260, actions: [36], search: true } },
  shap: { Body: ShapBody, bar: { title: 170, subtitle: 280, actions: [36], search: true } },
  ajustes: { Body: AjustesBody, bar: { title: 100, subtitle: 340, actions: [140, 110] } },
  perfil: { Body: PerfilBody, bar: { title: 110, subtitle: 240 } },
  acerca: { Body: AcercaBody, bar: { title: 150, subtitle: 240, search: true } },
};

/** Ruta -> clave de pantalla (null si no se reconoce). */
export function pageKeyFromPath(pathname = "") {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p === "/") return "dashboard";
  if (p === "/parcelas") return "parcelas";
  if (p === "/parcelas/historial") return "historial";
  if (/^\/parcelas\/[^/]+$/.test(p)) return "detalle";
  const map = { "/modelo": "modelo", "/mapa": "mapa", "/predicciones": "predicciones", "/satelite": "satelite", "/shap": "shap", "/ajustes": "ajustes", "/perfil": "perfil", "/acerca": "acerca" };
  return map[p] ?? null;
}

/** Solo el cuerpo de la pantalla (la barra superior real ya está pintada). */
export function PageBodySkeleton({ page }) {
  if (page === "mapa") return <MapaSkeleton />;
  if (page === "modeloTab") {
    // Contenido de una pestaña de Modelo: la barra superior y las pestañas reales ya están pintadas.
    return (
      <div role="status" aria-busy="true" aria-label="Cargando" className="app-skeleton w-full">
        <ModeloBody tabs={false} />
      </div>
    );
  }
  const Body = (PAGES[page] ?? PAGES.dashboard).Body;
  return (
    <div role="status" aria-busy="true" aria-label="Cargando" className="app-skeleton w-full">
      <Body />
      <span className="sr-only">Cargando…</span>
    </div>
  );
}

/** Barra superior fantasma + cuerpo: mientras baja el código de la pantalla. */
export function RouteSkeleton({ page }) {
  if (page === "mapa") return <PageBodySkeleton page="mapa" />;
  const cfg = PAGES[page] ?? PAGES.dashboard;
  return (
    <div role="status" aria-busy="true" aria-label="Cargando" className="app-skeleton w-full">
      <TopBarSkeleton {...cfg.bar} />
      <cfg.Body />
      <span className="sr-only">Cargando…</span>
    </div>
  );
}

/** Pantalla completa sin layout aún (verificando sesión): sidebar fantasma + la pantalla que se pidió. */
export function FullScreenSkeleton({ page }) {
  return (
    <div className="app-skeleton flex h-screen w-full overflow-hidden bg-white supports-[height:100dvh]:h-dvh dark:bg-black">
      <aside className="hidden w-[232px] shrink-0 border-r border-gray-100 p-5 dark:border-gray-800/70 lg:block">
        <B h={28} w={120} strong className="mb-8" />
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="mb-3 flex items-center gap-3">
            <B circle h={20} w={20} />
            <B h={12} w={100 + ((i * 17) % 40)} />
          </div>
        ))}
      </aside>
      <main className="min-w-0 flex-1 overflow-hidden">
        <RouteSkeleton page={page} />
      </main>
    </div>
  );
}

export default RouteSkeleton;
