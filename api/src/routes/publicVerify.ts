import { Router } from "express";
import { prisma } from "../db";
import { Signal, VerifySource } from "@prisma/client";
import { recomputeListingConfidence } from "../services/confidence";

const router = Router();

router.post("/:listingId/verify", async (req, res) => {
  const { listingId } = req.params;
  const { signal } = req.body ?? {};

  if (signal !== "YES" && signal !== "NO") {
    return res.status(400).json({ error: "signal must be YES or NO" });
  }

  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) return res.status(404).json({ error: "Listing not found" });

  // Identify voter (anonymous fingerprint)
  const ip =
    (req.headers["x-forwarded-for"] as string | undefined)
      ?.split(",")[0]
      ?.trim() ??
    req.ip ??
    req.socket.remoteAddress ??
    "unknown";

  const ua = req.headers["user-agent"] ?? "unknown";
  const fingerprint = `${ip}::${ua}`;

  // Dedupe window
  const since = new Date(Date.now() - 12 * 3600 * 1000);

  // ✅ DEDUPE BEFORE INSERT
  const recent = await prisma.verificationEvent.findFirst({
    where: {
      listingId,
      fingerprint,
      createdAt: { gte: since },
    },
  });

  if (recent) {
    return res.status(429).json({ error: "Already voted recently" });
  }

  // MVP: anonymous QR scan vote (low weight)
  const weight = 0.2;

  // ✅ SINGLE INSERT
  await prisma.verificationEvent.create({
    data: {
      listingId,
      signal: signal as Signal,
      weight,
      fingerprint,
      source: VerifySource.QR,
    },
  });

  // MVP rule: YES updates lastVerifiedAt
  if (signal === "YES") {
    await prisma.listing.update({
      where: { id: listingId },
      data: { lastVerifiedAt: new Date() },
    });
  }

  const confidenceScore = await recomputeListingConfidence(listingId);

  return res.json({ ok: true, confidenceScore });
});

export default router;
