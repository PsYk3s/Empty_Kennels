import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet } from "../api";

type Listing = {
  id: string;
  status: "DRAFT" | "AVAILABLE" | "UNAVAILABLE" | "ADOPTED";
  confidenceScore: number;
  lastVerifiedAt: string | null;
  animal: {
    id: string;
    name: string;
    species: string;
    breed?: string | null;
    description?: string | null;
    photoUrl?: string | null;
    spcaId: string;
  };
};

function statusLabel(status: Listing["status"]) {
  if (status === "ADOPTED") return "CLOSED";
  return status;
}

export default function QrScan() {
  const { token } = useParams();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["qr", token],
    queryFn: () => apiGet<Listing>(`/api/qr/${token}`),
    enabled: !!token,
  });

  const vote = useMutation({
    mutationFn: async (signal: "YES" | "NO") => {
      const res = await fetch(`/api/listings/${data!.id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signal }),
      });

      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = (payload as { error?: string })?.error ?? `Vote failed: ${res.status}`;
        throw new Error(msg);
      }

      return payload as { ok: true; confidenceScore?: number };
    },

    onSuccess: async (payload, signal) => {
      qc.setQueryData(["qr", token], (old: Listing | undefined) => {
        if (!old) return old;

        return {
          ...old,
          confidenceScore: payload.confidenceScore ?? old.confidenceScore,
          lastVerifiedAt:
            signal === "YES" ? new Date().toISOString() : old.lastVerifiedAt,
        };
      });

      await qc.invalidateQueries({ queryKey: ["qr", token] });
      await qc.invalidateQueries({ queryKey: ["public-animals"] });
    },
  });

  if (isLoading) return <div style={{ padding: 24 }}>Loading...</div>;
  if (error) return <div style={{ padding: 24 }}>Invalid QR</div>;
  if (!data) return <div style={{ padding: 24 }}>Not found</div>;

  function hoursSince(dateIso: string | null) {
    if (!dateIso) return null;
    const ms = Date.now() - new Date(dateIso).getTime();
    return ms / 36e5;
  }

  const h = hoursSince(data.lastVerifiedAt);
  const freshness =
    h === null
      ? "Unknown"
      : h <= 48
        ? "Fresh"
        : h <= 96
          ? "Stale"
          : "Unreliable";

  return (
    <div
      style={{
        padding: 24,
        fontFamily: "system-ui",
        maxWidth: 520,
        margin: "0 auto",
      }}
    >
      <h1>{data.animal.name}</h1>
      <div style={{ opacity: 0.75, marginBottom: 12 }}>
        {data.animal.species}
        {data.animal.breed ? ` • ${data.animal.breed}` : ""}
      </div>

      {data.animal.photoUrl ? (
        <img
          src={data.animal.photoUrl}
          alt={data.animal.name}
          style={{
            width: "100%",
            maxHeight: 280,
            objectFit: "cover",
            borderRadius: 10,
          }}
        />
      ) : null}

      {data.animal.description ? (
        <p style={{ marginTop: 12 }}>{data.animal.description}</p>
      ) : null}

      <div
        style={{
          marginTop: 16,
          padding: 12,
          border: "1px solid #ddd",
          borderRadius: 10,
        }}
      >
        <div>
          <strong>Status:</strong> {statusLabel(data.status)}
        </div>
        <div>
          <strong>Last confirmed:</strong> {data.lastVerifiedAt ?? "Unknown"}
        </div>
        <div>
          <div>
            <strong>Freshness:</strong> {freshness}
          </div>
          <div>
            <strong>Confidence:</strong> {data.confidenceScore}/100
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
        <button
          style={{ padding: 12, fontSize: 16 }}
          disabled={vote.isPending || !data}
          onClick={() => vote.mutate("YES")}
        >
          ✅ Still here
        </button>

        <button
          style={{ padding: 12, fontSize: 16 }}
          disabled={vote.isPending || !data}
          onClick={() => vote.mutate("NO")}
        >
          ❌ Not here
        </button>
      </div>

      <div>
        {vote.isError ? (
          <div style={{ marginTop: 10, color: "crimson" }}>
            {(vote.error as Error).message}
          </div>
        ) : null}
      </div>

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
        This helps keep listings accurate.
      </div>
    </div>
  );
}
