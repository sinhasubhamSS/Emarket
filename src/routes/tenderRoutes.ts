import express from "express";
import { getAllTenders, getTenderByNumber } from "../controllers/tenderController";

const router = express.Router();

// GET /api/tenders - fetch all tenders
router.get("/", getAllTenders);

// GET /api/tenders/:tenderNo - fetch tender by tenderNo (bidNumber)
router.get("/:tenderNo", getTenderByNumber);

export default router;
