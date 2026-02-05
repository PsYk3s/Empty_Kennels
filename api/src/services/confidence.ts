import { prisma } from "../db";

export async function recomputeListingConfidence(listingId: string) {
  const since = new Date(Date.now() - 48 * 3600 * 1000);

  const events = await prisma.verificationEvent.findMany({
    where: { listingId, createdAt: { gte: since } },
    select: { signal: true, weight: true }
  });

  let net = 0;
  for (const e of events) {
    net += (e.signal === "YES" ? 1 : -1) * e.weight;
  }

  // neutral baseline 50, adjust by net votes
  const confidenceScore = Math.max(0, Math.min(100, Math.round(50 + net * 25)));

  await prisma.listing.update({
    where: { id: listingId },
    data: { confidenceScore }
  });

  return confidenceScore;
}
