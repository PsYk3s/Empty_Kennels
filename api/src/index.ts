import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import staffListings from "./routes/staffListings";
import staffCreateListing from "./routes/staffCreateListing";
import staffUpdateListingStatus from "./routes/staffUpdateListingStatus";
import publicAnimals from "./routes/publicAnimals";
import staffQr from "./routes/staffQr";
import publicQr from "./routes/publicQr";
import publicVerify from "./routes/publicVerify";

dotenv.config();

const app = express();

app.set("trust proxy", true);

app.use(cors());
app.use(express.json());

app.use("/api/staff/listings", staffListings);
app.use("/api/staff/listings", staffCreateListing);
app.use("/api/staff/listings", staffUpdateListingStatus);
app.use("/api/animals", publicAnimals);
app.use("/api/staff/listings", staffQr);
app.use("/api/qr", publicQr);
app.use("/api/listings", publicVerify);


app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

const port = Number(process.env.API_PORT ?? 3001);
app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});
