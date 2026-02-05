import { Router } from "express";
import { prisma } from "../db";
import { requireStaff } from "../auth";

const router = Router();

router.get("/", requireStaff, async (req, res) => {
  const membership = (req as any).membership;
  const status = req.query.status as string | undefined;

  const listings = await prisma.listing.findMany({
    where: {
      status: status as any,
      animal: {
        spcaId: membership.spcaId
      }
    },
    include: {
      animal: true
    },
    orderBy: {
      animal: {
        createdAt: "desc"
      }
    }
  });

  res.json(
    listings.map(l => ({
      listingId: l.id,
      status: l.status,
      confidenceScore: l.confidenceScore,
      lastVerifiedAt: l.lastVerifiedAt,
      animal: {
        id: l.animal.id,
        name: l.animal.name,
        species: l.animal.species,
        breed: l.animal.breed,
        photoUrl: l.animal.photoUrl
      }
    }))
  );
});

export default router;
