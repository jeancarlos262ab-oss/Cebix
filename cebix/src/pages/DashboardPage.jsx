import TopBar from "../components/layout/TopBar";
import ParcelSummary from "../components/dashboard/ParcelSummary";
import YieldTrend from "../components/dashboard/YieldTrend";
import ParcelsTable from "../components/dashboard/ParcelsTable";

export default function DashboardPage() {
  return (
    <>
      <TopBar title="Parcelas evaluadas" subtitle="Del dato satelital a la decisión financiera." />

      <div className="mt-6 h-px w-full bg-gray-200 dark:bg-gray-700" aria-hidden="true" />

      <div className="grid grid-cols-1 px-4 py-6 sm:px-6 lg:px-8 lg:grid-cols-[280px_1px_1fr] lg:gap-8">
        <ParcelSummary />

        <div className="hidden bg-gray-200 dark:bg-gray-700 lg:block" aria-hidden="true" />

        <div>
          <YieldTrend />
          <div className="my-6 h-px w-full bg-gray-200 dark:bg-gray-700" aria-hidden="true" />
          <ParcelsTable />
        </div>
      </div>
    </>
  );
}
