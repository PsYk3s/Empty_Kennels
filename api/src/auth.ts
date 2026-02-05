import { Request, Response, NextFunction } from "express";
import { prisma } from "./db";

export async function requireUser(req: Request, res: Response, next: NextFunction) {
  const phone = req.header("x-dev-phone");
  if (!phone) return res.status(401).json({ error: "Missing x-dev-phone" });

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) return res.status(401).json({ error: "Unknown user" });

  (req as any).user = user;
  next();
}

export async function requireStaff(req: Request, res: Response, next: NextFunction) {
  await requireUser(req, res, async () => {
    const user = (req as any).user;

    const membership = await prisma.membership.findFirst({
      where: { userId: user.id, role: "STAFF" },
      include: { spca: true }
    });

    if (!membership) return res.status(403).json({ error: "Not staff" });

    (req as any).membership = membership;
    next();
  });
}
