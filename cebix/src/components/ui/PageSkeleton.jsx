import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

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

const Head = ({ w = 150, desc = 0 }) => (
  <div className="mb-3">
    <B h={16} w={w} strong />
    {desc ? <B h={11} w={desc} className="mt-2" /> : null}
  </div>
);

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

const Btn = ({ w = 110, h = 38 }) => <B h={h} w={w} r={8} />;

const Tabs = ({ widths = [70, 70, 60, 80] }) => (
  <div className="flex gap-5 border-b border-gray-200 pb-3 dark:border-gray-800">
    {widths.map((w, i) => (
      <B key={i} h={14} w={w} />
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
  <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
    <div className="flex items-center gap-4">
      <B h={14} w={130} />
      <B h={30} w={96} r={8} />
    </div>
    <div className="flex gap-1">
      <B h={36} w={36} r={8} />
      <B h={36} w={36} r={8} />
      <B h={36} w={36} r={8} />
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
  
  return <Skeleton height={height} borderRadius={rounded ? 16 : 0} containerClassName={`block h-full w-full ${className}`} />;
}

const PAD = "px-4 sm:px-6 lg:px-8";

function TopBarSkeleton({ title = 200, subtitle = 320, actions = [], search = false }) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-4 pt-4 sm:pt-6 ${PAD}`}>
      <div className="min-w-0">
        <B h={24} w={title} strong />
        <B h={14} w={subtitle} className="mt-2 max-w-full" />
      </div>
      <div className="flex items-center gap-3">
        {actions.map((w, i) => (w === "icon" ? <B key={i} circle h={36} w={36} /> : <Btn key={i} w={w} />))}
        {search && <B h={38} w={256} r={999} className="hidden sm:block" />}
      </div>
    </div>
  );
}

function DashboardBody() {
  return (
    <div className={`mt-6 grid grid-cols-1 items-start gap-10 py-6 lg:grid-cols-[280px_1fr] ${PAD}`}>
      <div className="min-w-0 space-y-10">
        <section>
          <Head w={160} desc={130} />
          <B h={224} r={16} className="my-8" />
          <Tabs widths={[72, 64, 40, 48]} />
          <KV rows={4} className="mt-1" />
        </section>
        <section>
          <Head w={230} />
          <HBars rows={4} labelW={80} />
        </section>
      </div>
      <div className="min-w-0 space-y-10">
        <section>
          <Head w={260} desc={380} />
          <Chart h={240} className="mt-6" />
        </section>
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <B h={16} w={150} strong />
            <div className="flex gap-2">
              <Btn w={100} />
              <Btn w={140} />
            </div>
          </div>
          <B h={126} r={16} className="mt-4" />
          <div className="mt-4 flex justify-end">
            <B h={36} w={36} r={8} />
          </div>
          <TableSkeleton rows={6} cols={[28, 120, 90, 80, 90, "flex"]} className="mt-1" />
          <Pager />
        </section>
      </div>
    </div>
  );
}

function ParcelasBody() {
  return (
    <div className={`mt-6 grid grid-cols-1 items-start gap-10 py-6 lg:grid-cols-[280px_1fr] ${PAD}`}>
      <aside className="min-w-0 space-y-10">
        <Panel>
          <Head w={140} desc={190} />
          <div className="-mx-5 mt-4 space-y-0.5">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-2.5">
                <B h={13} w={60 + ((i * 17) % 40)} />
                <B h={12} w={22} />
              </div>
            ))}
          </div>
        </Panel>
        <Panel>
          <B h={16} w={150} strong />
          <B h={6} r={2} className="mb-3 mt-4" />
          <div className="-mx-5 space-y-0.5">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-2.5">
                <B h={8} w={8} r={2} />
                <B h={13} w={90} className="flex-1" />
                <B h={12} w={30} />
                <B h={13} w={22} />
              </div>
            ))}
          </div>
        </Panel>
        <section>
          <Head w={190} desc={260} />
          <B h={126} r={16} className="mt-3" />
        </section>
      </aside>
      <div className="min-w-0 space-y-10">
        <Chart h={340} />
        <section>
          <div className="mb-3 flex items-center justify-between">
            <B h={16} w={150} strong />
            <B h={36} w={36} r={8} />
          </div>
          <TableSkeleton rows={7} cols={[28, 130, 90, 80, 80, "flex"]} />
          <Pager />
        </section>
      </div>
    </div>
  );
}

function HistorialBody() {
  return (
    <div className={`mt-6 space-y-4 py-6 ${PAD}`}>
      <div className="flex flex-wrap items-center gap-3">
        <B h={38} r={999} className="min-w-[220px] flex-1" />
        <div className="flex flex-wrap gap-1.5">
          {[78, 96, 96, 84].map((w, i) => (
            <B key={i} h={36} w={w} r={999} />
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 px-4 py-3 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <B h={18} w={18} r={4} />
          <B h={14} w={130} />
          <B h={14} w={110} />
        </div>
        <Btn w={110} h={36} />
      </div>
      <TableSkeleton rows={10} cols={[20, 170, 110, 80, 60, "flex", 60]} />
      <Pager />
    </div>
  );
}

function DetalleBody() {
  return (
    <div className={`mt-6 space-y-10 py-6 ${PAD}`}>
      <div className="grid grid-cols-1 gap-10 xl:grid-cols-[minmax(0,1fr)_230px_360px]">
        <B h={288} r={16} />
        <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="border-b border-gray-200 p-5 last:border-b-0 dark:border-gray-800">
              <B h={10} w={80} />
              <B h={26} w={90} className="mt-2" strong />
              <B h={10} w={120} className="mt-2" />
            </div>
          ))}
        </div>
        <B h={190} r={16} />
      </div>
      <div className="grid grid-cols-1 items-start gap-10 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-10">
          <Panel>
            <B h={10} w={140} />
            <B h={40} w={260} className="mt-3" strong />
            <B h={12} r={999} className="mt-5" />
          </Panel>
          <Panel>
            <B h={10} w={250} />
            <B h={12} w={340} className="mb-5 mt-3 max-w-full" />
            <HBars rows={8} labelW={150} />
          </Panel>
          <section>
            <B h={10} w={230} className="mb-4" />
            <TableSkeleton rows={5} cols={[160, 90, 90, "flex"]} />
          </section>
        </div>
        <section className="space-y-10">
          <div>
            <B h={10} w={110} className="mb-3" />
            <div className="overflow-hidden rounded-2xl border border-gray-200 px-4 dark:border-gray-800">
              <KV rows={5} />
            </div>
          </div>
          <Btn w="100%" h={42} />
        </section>
      </div>
    </div>
  );
}

function StepSk({ n, last = false, children, title = 150, desc = 330 }) {
  return (
    <section className="relative flex gap-4">
      {!last && <span aria-hidden="true" className="absolute -bottom-10 left-3.5 top-9 w-px -translate-x-1/2 bg-gray-200 dark:bg-gray-800" />}
      <B h={28} w={28} r={6} className="relative z-10 shrink-0" />
      <div className="min-w-0 flex-1">
        <B h={14} w={title} strong />
        <B h={12} w={desc} className="mt-2 max-w-full" />
        <div className="mt-4">{children}</div>
      </div>
    </section>
  );
}

function EjecutarBody() {
  return (
    <div className={`mt-6 py-6 ${PAD}`}>
      <Tabs widths={[110, 150, 120, 60]} />
      <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_200px] lg:grid-cols-[minmax(0,1fr)_240px] lg:gap-12">
        <aside className="order-first md:order-last">
          <div className="flex justify-center py-2 md:py-4">
            <B circle h={176} w={176} />
          </div>
          <div className="mt-4 space-y-2.5">
            <B h={12} w={110} strong />
            <LinesSkeleton lines={4} />
          </div>
        </aside>
        <div className="min-w-0 space-y-10">
          <StepSk n={1} title={140} desc={380}>
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
              <div className="flex-1">
                <B h={13} w={150} strong />
                <B h={11} w="80%" className="mt-2" />
              </div>
              <Btn w={210} />
            </div>
          </StepSk>
          <StepSk n={2} title={120} desc={340}>
            <div className="space-y-4">
              <B h={118} r={16} />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <B h={64} r={12} />
                <B h={64} r={12} />
              </div>
              <Btn w={150} h={42} />
            </div>
          </StepSk>
          <StepSk n={3} title={100} desc={260}>
            <TableSkeleton rows={4} cols={[60, 90, 70, 100, "flex"]} />
          </StepSk>
          <StepSk n={4} last title={170} desc={360}>
            <div className="flex flex-wrap items-center gap-2">
              <B h={38} w={220} r={8} />
              <Btn w={150} />
            </div>
          </StepSk>
        </div>
      </div>
    </div>
  );
}

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

function PrediccionesBody() {
  return (
    <div className={`mt-6 grid grid-cols-1 items-start gap-12 py-8 lg:grid-cols-[280px_1fr] lg:gap-14 ${PAD}`}>
      <aside className="min-w-0 space-y-10">
        <section>
          <Head w={150} desc={230} />
          <B h={42} r={999} />
        </section>
        <section>
          <Head w={130} />
          <B h={150} r={16} />
        </section>
        <section>
          <Head w={130} />
          <KV rows={2} />
          <Btn w="100%" h={42} />
        </section>
      </aside>
      <div className="min-w-0 space-y-10">
        <header className="border-b border-gray-200 pb-4 dark:border-gray-800">
          <B h={10} w={80} />
          <B h={20} w={220} className="mt-2" strong />
          <B h={13} w={280} className="mt-2" />
        </header>
        <section>
          <B h={50} w={200} strong />
          <B h={12} r={999} className="mt-5" />
          <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i}>
                <B h={10} w={80} />
                <B h={22} w={70} className="mt-2" strong />
              </div>
            ))}
          </div>
        </section>
        <section>
          <B h={10} w={190} />
          <B h={12} w={380} className="mb-4 mt-2 max-w-full" />
          <HBars rows={8} labelW={150} />
        </section>
        <section className="grid grid-cols-1 gap-x-10 gap-y-8 md:grid-cols-2">
          <div>
            <B h={10} w={80} className="mb-3" />
            <Chart h={260} />
          </div>
          <div>
            <B h={10} w={100} className="mb-3" />
            <div className="overflow-hidden rounded-2xl border border-gray-200 px-4 dark:border-gray-800">
              <KV rows={4} />
            </div>
          </div>
        </section>
        <section>
          <B h={10} w={260} />
          <B h={12} w={400} className="mb-3 mt-2 max-w-full" />
          <TableSkeleton rows={4} cols={[160, 90, 90, "flex"]} />
        </section>
      </div>
    </div>
  );
}

function SateliteBody() {
  return (
    <div className={`space-y-6 py-6 ${PAD}`}>
      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
        <div className="h-[320px] sm:h-[380px] lg:h-[420px]">
          <BlockSkeleton height="100%" />
        </div>
        <aside className="grid min-w-0 grid-cols-1 divide-y divide-gray-200 border-t border-gray-200 dark:divide-gray-800 dark:border-gray-800 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
          {[
            <>
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map((i) => (
                  <B key={i} h={38} r={8} />
                ))}
                <B h={38} r={8} className="col-span-3" />
              </div>
              <div className="mt-3 flex gap-1.5">
                <B h={28} w={112} r={6} />
                <B h={28} w={120} r={6} />
              </div>
            </>,
            <div className="space-y-2.5">
              <B h={32} r={6} />
              <div className="grid grid-cols-2 gap-2">
                <B h={32} r={6} />
                <B h={32} r={6} />
              </div>
              <B h={10} w="80%" />
            </div>,
            <>
              <B h={10} w="70%" />
              <div className="mt-2 grid grid-cols-1 gap-1.5 @md:grid-cols-2">
                <B h={58} r={8} />
                <B h={58} r={8} />
              </div>
              <B h={34} r={6} className="mt-3" />
            </>,
          ].map((content, i) => (
            <section key={i} className={`min-w-0 px-4 py-4 ${i === 2 ? "@container" : ""}`}>
              <div className="mb-2.5 flex items-center gap-2.5">
                <B circle h={20} w={20} />
                <B h={13} w={[140, 110, 90][i]} strong />
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

function AjustesBody() {
  const Section = ({ children }) => (
    <section className="mb-6 overflow-hidden rounded-2xl border border-gray-200 last:mb-0 dark:border-gray-800">
      <header className="flex items-start gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-800">
        <B h={17} w={17} r={4} className="mt-0.5" />
        <div>
          <B h={14} w={110} strong />
          <B h={11} w={230} className="mt-2" />
        </div>
      </header>
      <div className="px-5">{children}</div>
    </section>
  );
  return (
    <div className={`mt-8 max-w-4xl sm:mt-10 ${PAD}`}>
      <Section>
        <div className="grid grid-cols-1 gap-5 py-5 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i}>
              <B h={110} r={12} />
              <B h={12} w={80} className="mt-3" strong />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-gray-200 py-4 dark:border-gray-800">
          <B h={13} w={150} />
          <div className="flex gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <B key={i} circle h={32} w={32} />
            ))}
          </div>
        </div>
      </Section>
      <Section>
        <div className="divide-y divide-gray-200 dark:divide-gray-800">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between py-4">
              <div>
                <B h={13} w={150} strong />
                <B h={11} w={250} className="mt-2" />
              </div>
              <B h={22} w={40} r={999} />
            </div>
          ))}
        </div>
      </Section>
      <Section>
        <div className="grid grid-cols-1 gap-4 py-5 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i}>
              <B h={11} w={90} />
              <B h={38} r={8} className="mt-2" />
            </div>
          ))}
        </div>
        <div className="border-t border-gray-200 py-4 dark:border-gray-800">
          <B h={12} w={320} />
        </div>
      </Section>
    </div>
  );
}

function PerfilBody() {
  return (
    <div className={`mt-8 grid max-w-5xl grid-cols-1 items-start gap-x-14 gap-y-12 sm:mt-10 lg:grid-cols-[300px_1fr] ${PAD}`}>
      <section className="flex min-w-0 flex-col items-center text-center">
        <B circle h={224} w={224} />
        <B h={26} w={190} className="mt-7" strong />
        <B h={13} w={220} className="mt-3" />
        <B h={13} w={170} className="mt-2" />
        <div className="mt-6">
          <Btn w={130} h={38} />
        </div>
      </section>
      <div className="min-w-0 space-y-12">
        <div className="grid grid-cols-3 gap-6">
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <B h={30} w={60} strong />
              <B h={11} w={90} className="mt-2" />
            </div>
          ))}
        </div>
        <section className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
          <header className="flex items-start gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-800">
            <B h={17} w={17} r={4} className="mt-0.5" />
            <div>
              <B h={14} w={90} strong />
              <B h={11} w={200} className="mt-2" />
            </div>
          </header>
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <B h={13} w={90} strong />
              <B h={11} w={180} className="mt-2" />
            </div>
            <Btn w={84} h={32} />
          </div>
        </section>
      </div>
    </div>
  );
}

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

const PAGES = {
  dashboard: { Body: DashboardBody, bar: { title: 190, subtitle: 320, search: true } },
  parcelas: { Body: ParcelasBody, bar: { title: 110, subtitle: 260, actions: [105, 145], search: true } },
  historial: { Body: HistorialBody, bar: { title: 200, subtitle: 130, actions: [160] } },
  detalle: { Body: DetalleBody, bar: { title: 200, subtitle: 260, actions: [160, 100, 110] } },
  modelo: { Body: EjecutarBody, bar: { title: 90, subtitle: 520, actions: ["icon"] } },
  predicciones: { Body: PrediccionesBody, bar: { title: 140, subtitle: 380, actions: ["icon"] } },
  satelite: { Body: SateliteBody, bar: { title: 170, subtitle: 480, actions: ["icon"] } },
  shap: { Body: ShapBody, bar: { title: 170, subtitle: 440, actions: ["icon"] } },
  ajustes: { Body: AjustesBody, bar: { title: 100, subtitle: 340, actions: [110] } },
  perfil: { Body: PerfilBody, bar: { title: 110, subtitle: 240 } },
  acerca: { Body: AcercaBody, bar: { title: 150, subtitle: 280 } },
};

export function pageKeyFromPath(pathname = "") {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p === "/") return "dashboard";
  if (p === "/parcelas") return "parcelas";
  if (p === "/parcelas/historial") return "historial";
  if (/^\/parcelas\/[^/]+$/.test(p)) return "detalle";
  const map = { "/modelo": "modelo", "/mapa": "mapa", "/predicciones": "predicciones", "/satelite": "satelite", "/shap": "shap", "/ajustes": "ajustes", "/perfil": "perfil", "/acerca": "acerca" };
  return map[p] ?? null;
}

export function PageBodySkeleton({ page }) {
  if (page === "mapa") return <MapaSkeleton />;
  if (page === "modeloTab") {
    
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