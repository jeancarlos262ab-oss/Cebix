import { MoreVertical, Wifi } from "lucide-react";

function CardFace({ className, tone }) {
  const numberGroups = ["1234", "1234", "1234", "1234"];
  return (
    <div
      className={`absolute h-40 w-64 p-4 text-white shadow-xl ${className}`}
      style={{
        background:
          tone === "dark"
            ? "linear-gradient(135deg, #1D2939 0%, #101828 60%, #0C111D 100%)"
            : "linear-gradient(135deg, #9E77ED 0%, #6941C6 55%, #1D2939 100%)",
      }}
    >
      <div className="flex items-start justify-between">
        <span className="text-[10px] font-medium uppercase tracking-widest text-white/70">
          {tone === "dark" ? "Lane Stevens" : "Untitled UI"}
        </span>
        <MoreVertical size={14} className="text-white/60" />
      </div>

      <div className="mt-7 flex items-center gap-1.5 text-[13px] font-medium tracking-[0.18em] text-white/90">
        {numberGroups.map((group, i) => (
          <span key={i}>{group}</span>
        ))}
      </div>

      <div className="mt-4 flex items-end justify-between">
        <span className="text-[10px] text-white/60">08/28</span>
        <Wifi size={16} className="rotate-90 text-white/60" />
      </div>
    </div>
  );
}

export default function CreditCardStack() {
  return (
    <div className="mt-4 flex h-56 items-center justify-center overflow-hidden bg-gray-50 dark:bg-gray-800">
      <div className="relative flex h-48 w-full items-center justify-center">
        <CardFace tone="dark" className="left-6 top-4 rotate-[-8deg]" />
        <CardFace tone="light" className="left-2 top-0 rotate-[-2deg]" />
        <span className="absolute bottom-2 right-8 h-2.5 w-6 bg-orange-400/90" />
        <span className="absolute bottom-8 right-16 h-2.5 w-6 bg-orange-400/70" />
      </div>
    </div>
  );
}
