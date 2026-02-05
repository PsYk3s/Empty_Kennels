import { PrismaClient, Role, ListingStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const spca = await prisma.spca.create({
    data: {
      name: "Pilot SPCA",
      city: "Pretoria",
      province: "Gauteng",
      lat: -25.7479,
      lng: 28.2293
    }
  });

  const owner = await prisma.user.create({
    data: { phone: "+27000000001" }
  });

  await prisma.membership.create({
    data: { role: Role.OWNER, userId: owner.id, spcaId: spca.id }
  });

  const staff = await prisma.user.create({
    data: { phone: "+27000000002" }
  });

  await prisma.membership.create({
    data: { role: Role.STAFF, userId: staff.id, spcaId: spca.id }
  });

  const animal = await prisma.animal.create({
    data: {
      name: "Buddy",
      species: "Dog",
      breed: "Mixed",
      description: "Friendly, energetic, loves people.",
      photoUrl: "https://placehold.co/600x400",
      spcaId: spca.id,
      listing: { create: { status: ListingStatus.AVAILABLE } }
    }
  });

  console.log("Seed complete:", { spcaId: spca.id, ownerPhone: owner.phone, staffPhone: staff.phone, animalId: animal.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
