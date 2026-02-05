import { Router } from "express";
import { prisma } from "../db";
import { requireStaff } from "../auth";
import { ListingStatus } from "@prisma/client";

const router = Router();

router.post("/", requireStaff, async (req, res) => {
  const membership = (req as any).membership;

  const { name, species, breed, description, photoUrl } = req.body ?? {};

  if (!name || !species) {
    return res.status(400).json({ error: "name and species are required" });
  }

  const animal = await prisma.animal.create({
    data: {
      name,
      species,
      breed: breed ?? null,
      description: description ?? null,
      photoUrl: photoUrl ?? null,
      spcaId: membership.spcaId,
      listing: {
        create: {
          status: ListingStatus.DRAFT
        }
      }
    },
    include: {
      listing: true
    }
  });

  res.status(201).json({
    listingId: animal.listing!.id,
    animalId: animal.id
  });
});

export default router;
