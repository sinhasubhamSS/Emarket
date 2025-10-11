import { Request, Response } from "express";
import * as tenderService from "../services/tenderService";

export async function getAllTenders(req: Request, res: Response) {
  try {
    const tenders = await tenderService.getAllTenders();
    res.json(tenders);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch tenders." });
  }
}

export async function getTenderByNumber(req: Request, res: Response) {
  try {
    const tenderNo = req.params.tenderNo;
    const tender = await tenderService.getTenderByNumber(tenderNo);
    if (!tender) return res.status(404).json({ error: "Tender not found." });
    res.json(tender);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch tender." });
  }
}
