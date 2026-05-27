"use client";

interface AllocationData {
  name: string;
  value: number;
  color: string;
}

interface Props {
  data: AllocationData[];
  totalBalance: number;
}

function DonutChart({ data }: { data: AllocationData[] }) {
  let accumulated = 0;
  const gradient = data
    .map((d) => {
      const start = accumulated * 3.6;
      accumulated += d.value;
      const end = accumulated * 3.6;
      return `${d.color} ${start}deg ${end}deg`;
    })
    .join(", ");

  return (
    <div
      style={{
        width: 120,
        height: 120,
        borderRadius: "50%",
        background: `conic-gradient(from 0deg, ${gradient})`,
        WebkitMask: "radial-gradient(circle, transparent 36px, white 37px)",
        mask: "radial-gradient(circle, transparent 36px, white 37px)",
        flexShrink: 0,
      }}
    />
  );
}

function CustomLegend({ data, totalBalance }: { data: AllocationData[]; totalBalance: number }) {
  return (
    <div className="flex flex-col gap-3 justify-center">
      {data.map((item) => (
        <div key={item.name} className="flex items-center gap-2">
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              background: item.color,
              flexShrink: 0,
            }}
          />
          <div>
            <div style={{ color: "var(--am-muted)", fontSize: 11 }}>{item.name}</div>
            <div style={{ color: "var(--am-text)", fontWeight: 700, fontSize: 13 }}>
              €{((item.value / 100) * totalBalance).toLocaleString("it-IT", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}{" "}
              <span style={{ color: "var(--am-muted)", fontWeight: 400, fontSize: 11 }}>
                ({item.value.toFixed(0)}%)
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AllocationPie({ data, totalBalance }: Props) {
  return (
    <div className="flex items-center gap-5 h-full" style={{ minHeight: 140 }}>
      <DonutChart data={data} />
      <CustomLegend data={data} totalBalance={totalBalance} />
    </div>
  );
}
