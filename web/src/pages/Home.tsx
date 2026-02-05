import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../api";

type PublicAnimal = {
  listingId: string;
  lastVerifiedAt: string | null;
  confidenceScore: number;
  status: "AVAILABLE";
  spcaId: string;
  animal: {
    id: string;
    name: string;
    species: string;
    breed?: string | null;
    description?: string | null;
    photoUrl?: string | null;
  };
};

function freshnessLabel(lastVerifiedAt: string | null) {
  if (!lastVerifiedAt) return "Unreliable";
  const hours = (Date.now() - new Date(lastVerifiedAt).getTime()) / 36e5;
  if (hours <= 48) return "Fresh";
  if (hours <= 96) return "Stale";
  return "Unreliable";
}

export default function Home() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["public-animals"],
    queryFn: () => apiGet<PublicAnimal[]>("/api/animals"),
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {(error as Error).message}</div>;

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Empty Kennels</h1>
      <p>Available animals: {data?.length ?? 0}</p>

      <div style={{ display: "grid", gap: 16 }}>
        {data?.map((item) => (
          <div
            key={item.listingId}
            style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8 }}
          >
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              {item.animal.photoUrl ? (
                <img
                  src={item.animal.photoUrl}
                  alt={item.animal.name}
                  width={96}
                  height={64}
                  style={{ objectFit: "cover", borderRadius: 6 }}
                />
              ) : null}
              <div>
                <strong>{item.animal.name}</strong>
                <div>
                  {item.animal.species}
                  {item.animal.breed ? ` • ${item.animal.breed}` : ""}
                </div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  Freshness: {freshnessLabel(item.lastVerifiedAt)} • Confidence:{" "}
                  {item.confidenceScore}/100
                </div>
              </div>
            </div>
            {item.animal.description ? (
              <p style={{ marginTop: 8 }}>{item.animal.description}</p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
