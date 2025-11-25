"use client";

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: React.CSSProperties;
}

export default function Skeleton({ 
  width = "100%", 
  height = 20, 
  borderRadius = 8,
  style 
}: SkeletonProps) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        background: "linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.5s infinite",
        ...style,
      }}
    >
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

// Skeleton para cards del dashboard
export function DashboardSkeleton() {
  return (
    <div style={{ padding: 20 }}>
      <Skeleton height={32} width={200} style={{ marginBottom: 24 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ background: "white", borderRadius: 12, padding: 20 }}>
            <Skeleton height={16} width={100} style={{ marginBottom: 12 }} />
            <Skeleton height={28} width={120} style={{ marginBottom: 8 }} />
            <Skeleton height={14} width={80} />
          </div>
        ))}
      </div>
      <div style={{ marginTop: 24, background: "white", borderRadius: 12, padding: 20 }}>
        <Skeleton height={24} width={150} style={{ marginBottom: 16 }} />
        <Skeleton height={200} />
      </div>
    </div>
  );
}

// Skeleton para lista de transacciones
export function TransactionsSkeleton() {
  return (
    <div style={{ padding: 20 }}>
      <Skeleton height={32} width={180} style={{ marginBottom: 20 }} />
      {[1, 2, 3, 4, 5].map(i => (
        <div 
          key={i} 
          style={{ 
            background: "white", 
            borderRadius: 12, 
            padding: 16, 
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            gap: 16
          }}
        >
          <Skeleton width={40} height={40} borderRadius="50%" />
          <div style={{ flex: 1 }}>
            <Skeleton height={16} width="60%" style={{ marginBottom: 8 }} />
            <Skeleton height={12} width="40%" />
          </div>
          <Skeleton height={20} width={80} />
        </div>
      ))}
    </div>
  );
}

// Skeleton para formularios
export function FormSkeleton() {
  return (
    <div style={{ padding: 20 }}>
      <Skeleton height={28} width={200} style={{ marginBottom: 24 }} />
      {[1, 2, 3].map(i => (
        <div key={i} style={{ marginBottom: 20 }}>
          <Skeleton height={14} width={100} style={{ marginBottom: 8 }} />
          <Skeleton height={48} />
        </div>
      ))}
      <Skeleton height={48} style={{ marginTop: 12 }} />
    </div>
  );
}

