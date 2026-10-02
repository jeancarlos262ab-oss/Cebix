import TopBar from "../components/layout/TopBar";
import ParcelSummary from "../components/dashboard/ParcelSummary";
import YieldTrend from "../components/dashboard/YieldTrend";
import ParcelsTable from "../components/dashboard/ParcelsTable";

export default function DashboardPage() {
  return (
    <>
      <TopBar title="Resumen general" subtitle="Del dato satelital a la decisión financiera." />

      <div className="mt-6" aria-hidden="true" />

      <div className="grid grid-cols-1 items-start gap-10 px-4 py-6 sm:px-6 lg:grid-cols-[280px_1fr] lg:px-8">
        <ParcelSummary />

        <div className="min-w-0 space-y-10">
          <YieldTrend />
          <ParcelsTable />
        </div>
      </div>
    </>
  );
}
