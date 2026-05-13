import { Router } from "express";
import { prisma } from "../db";
import { requireStaff } from "../auth";
import crypto from "crypto";

const router = Router();

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

router.post("/:listingId/qr", requireStaff, async (req, res) => {
  const membership = (req as any).membership;
  const listingId = firstParam(req.params.listingId);
  if (!listingId) return res.status(400).json({ error: "Missing listingId" });

  const listing = await prisma.listing.findUnique({
    where: { id: listingId }
  });

  if (!listing) return res.status(404).json({ error: "Not found" });

  const animal = await prisma.animal.findUnique({ where: { id: listing.animalId } });
  if (!animal) return res.status(404).json({ error: "Animal not found" });
  if (animal.spcaId !== membership.spcaId) return res.status(403).json({ error: "Forbidden" });

  const existingQr = await prisma.qrToken.findUnique({ where: { listingId } });
  if (existingQr) {
    return res.json({ token: existingQr.token });
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
