import { Router } from "express";
import { prisma } from "../db";
import { ListingStatus } from "@prisma/client";

const router = Router();

router.get("/", async (req, res) => {
  const spcaId = (req.query.spcaId as string | undefined) ?? undefined;

  const listings = await prisma.listing.findMany({
    where: {
      status: ListingStatus.AVAILABLE,
      animal: spcaId ? { spcaId } : undefined
    },
    include: { animal: true },
    orderBy: { animal: { createdAt: "desc" } },
    take: 50
  });

  res.json(
    listings.map(l => ({
      listingId: l.id,
      status: l.status,
      confidenceScore: l.confidenceScore,
      lastVerifiedAt: l.lastVerifiedAt,
      spcaId: l.animal.spcaId,
      animal: {
        id: l.animal.id,
        name: l.animal.name,
        species: l.animal.species,
        breed: l.animal.breed,
        description: l.animal.description,
        photoUrl: l.animal.photoUrl
      }
    }))
  );
});

export default router;
