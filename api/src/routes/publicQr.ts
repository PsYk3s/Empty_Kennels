import { Router } from "express";
import { prisma } from "../db";

const router = Router();

router.get("/:token", async (req, res) => {
  const { token } = req.params;

  const qr = await prisma.qrToken.findUnique({
    where: { token },
    include: { listing: { include: { animal: true } } }
  });

  if (!qr) return res.status(404).json({ error: "Invalid QR" });

  res.json(qr.listing);
});

export default router;
