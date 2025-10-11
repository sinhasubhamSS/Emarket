import Tender, { ITender } from "../models/tender.model";

export async function saveTender(tenderData: Partial<ITender>): Promise<ITender> {
  // Check if tender already exists by tenderNo (bidNumber)
  const existingTender = await Tender.findOne({ tenderNo: tenderData.tenderNo });
  if (existingTender) {
    // Optionally update existing tender with new data (if needed)
    return existingTender;
  }

  const tender = new Tender(tenderData);
  return tender.save();
}

export async function getAllTenders(): Promise<ITender[]> {
  return Tender.find().sort({ createdAt: -1 }).exec();
}

export async function getTenderByNumber(tenderNo: string): Promise<ITender | null> {
  return Tender.findOne({ tenderNo }).exec();
}
