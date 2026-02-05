import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch } from "../api";

type StaffMe = {
  userId: string;
  role: "STAFF";
  spca: { id: string; name: string; city: string; province: string };
};

type StaffListing = {
  listingId: string;
  status: "DRAFT" | "AVAILABLE" | "UNAVAILABLE" | "ADOPTED";
  confidenceScore: number;
  lastVerifiedAt: string | null;
  animal: {
    id: string;
    name: string;
    species: string;
    breed?: string | null;
    photoUrl?: string | null;
  };
};

const STATUSES: StaffListing["status"][] = [
  "DRAFT",
  "AVAILABLE",
  "UNAVAILABLE",
  "ADOPTED",
];

export default function Staff() {
  const qc = useQueryClient();
  const [devPhone, setDevPhone] = useState("+27000000002");
  const [status, setStatus] = useState<StaffListing["status"]>("DRAFT");
  const [qrLinks, setQrLinks] = useState<Record<string, string>>({});

  const { data: me } = useQuery({
    queryKey: ["staff-me", devPhone],
    queryFn: () => apiGet<StaffMe>("/api/staff/me", { devPhone }),
    enabled: !!devPhone,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["staff-listings", devPhone, status],
    queryFn: () =>
      apiGet<StaffListing[]>(`/api/staff/listings?status=${status}`, {
        devPhone,
      }),
    enabled: !!devPhone,
  });

  const getQr = useMutation({
    mutationFn: async (listingId: string) => {
      const res = await fetch(`/api/staff/listings/${listingId}/qr`, {
        method: "POST",
        headers: { "x-dev-phone": devPhone },
      });
      if (!res.ok) throw new Error("QR generation failed");
      return res.json() as Promise<{ token: string }>;
    },
    onSuccess: (data, listingId) => {
      const url = `${window.location.origin}/q/${data.token}`;
      setQrLinks((prev) => ({ ...prev, [listingId]: url }));
    },
  });

  const updateStatus = useMutation({
    mutationFn: (vars: { listingId: string; status: StaffListing["status"] }) =>
      apiPatch(
        `/api/staff/listings/${vars.listingId}/status`,
        { status: vars.status },
        { devPhone },
      ),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["staff-listings"] });
      await qc.invalidateQueries({ queryKey: ["public-animals"] });
    },
  });

  const createListing = useMutation({
    mutationFn: (body: { name: string; species: string; breed?: string; description?: string; photoUrl?: string }) =>
      fetch("/api/staff/listings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-dev-phone": devPhone,
        },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["staff-listings"] });
    },
  });

  const actions = useMemo(() => {
    if (status === "DRAFT") return ["AVAILABLE"] as const;
    if (status === "AVAILABLE") return ["UNAVAILABLE", "ADOPTED"] as const;
    if (status === "UNAVAILABLE") return ["AVAILABLE", "ADOPTED"] as const;
    if (status === "ADOPTED") return ["AVAILABLE"] as const;
    return [] as const;
  }, [status]);

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Staff Dashboard</h1>

      <h2>Create Draft Listing</h2>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget as HTMLFormElement;
          const data = new FormData(form);

          createListing.mutate({
            name: data.get("name") as string,
            species: data.get("species") as string,
            breed: (data.get("breed") as string) || undefined,
            description: (data.get("description") as string) || undefined,
            photoUrl: (data.get("photoUrl") as string) || undefined,
          });

          form.reset();
        }}
        style={{ marginBottom: 24, display: "grid", gap: 8, maxWidth: 400 }}
      >
        <input name="name" placeholder="Name" required />
        <input name="species" placeholder="Species" required />
        <input name="breed" placeholder="Breed" />
        <input name="description" placeholder="Description" />
        <input name="photoUrl" placeholder="Photo URL" />
        <button type="submit">Create Draft</button>
      </form>

      <div style={{ marginBottom: 12 }}>
        <label>
          Dev phone:{" "}
          <input
            value={devPhone}
            onChange={(e) => setDevPhone(e.target.value)}
            style={{ padding: 6, width: 180 }}
          />
        </label>
      </div>

      {me ? (
        <div style={{ marginBottom: 12 }}>
          Signed in as <strong>{me.role}</strong> for{" "}
          <strong>{me.spca.name}</strong> ({me.spca.city}, {me.spca.province})
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            disabled={status === s}
            style={{ padding: "6px 10px" }}
          >
            {s}
          </button>
        ))}
      </div>

      {isLoading ? <div>Loading...</div> : null}
      {error ? <div>Error: {(error as Error).message}</div> : null}

      <div style={{ display: "grid", gap: 12 }}>
        {data?.map((l) => (
          <div
            key={l.listingId}
            style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8 }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "flex-start",
              }}
            >
              <div>
                <strong>{l.animal.name}</strong> — {l.animal.species}
                {l.animal.breed ? ` • ${l.animal.breed}` : ""}
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  Status: {l.status}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  justifyContent: "flex-end",
                }}
              >
                {actions.map((a) => (
                  <button
                    key={a}
                    onClick={() =>
                      updateStatus.mutate({ listingId: l.listingId, status: a })
                    }
                    disabled={updateStatus.isPending}
                  >
                    Set {a}
                  </button>
                ))}

                <button
                  onClick={() => getQr.mutate(l.listingId)}
                  disabled={getQr.isPending}
                >
                  Get QR link
                </button>
              </div>
            </div>

            {qrLinks[l.listingId] ? (
              <div style={{ marginTop: 8, fontSize: 12 }}>
                QR URL:{" "}
                <a href={qrLinks[l.listingId]} target="_blank" rel="noreferrer">
                  {qrLinks[l.listingId]}
                </a>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
