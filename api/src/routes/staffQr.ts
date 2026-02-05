import { Router } from "express";
import { prisma } from "../db";
import { requireStaff } from "../auth";
import crypto from "crypto";

const router = Router();

router.post("/:listingId/qr", requireStaff, async (req, res) => {
  const membership = (req as any).membership;
  const { listingId } = req.params;

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: { animal: true, qr: true }
  });

  if (!listing) return res.status(404).json({ error: "Not found" });
  if (listing.animal.spcaId !== membership.spcaId)
    return res.status(403).json({ error: "Forbidden" });

  if (listing.qr) {
    return res.json({ token: listing.qr.token });
  }

  const token = crypto.randomUUID();

  const qr = await prisma.qrToken.create({
    data: {
      token,
      listingId
    }
  });

  res.json({ token: qr.token });
});

export default router;
