import { Router } from "express";
import { prisma } from "../db";
import { requireStaff } from "../auth";
import { ListingStatus } from "@prisma/client";

const router = Router();

router.patch("/:listingId/status", requireStaff, async (req, res) => {
  const membership = (req as any).membership;
  const { listingId } = req.params;
  const { status } = req.body ?? {};

  if (!status || !Object.values(ListingStatus).includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: { animal: true }
  });

  if (!listing) return res.status(404).json({ error: "Listing not found" });
  if (listing.animal.spcaId !== membership.spcaId) return res.status(403).json({ error: "Forbidden" });

  const updated = await prisma.listing.update({
    where: { id: listingId },
    data: { status }
  });

  res.json({ listingId: updated.id, status: updated.status });
});

export default router;
