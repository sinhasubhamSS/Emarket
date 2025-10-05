import mongoose, { Schema, Document } from "mongoose";

export interface ITender extends Document {
  tenderNo: string; // GEM/2025/B/xxxxxxx
  title?: string; // Bid Title
  category?: string; // Item/Service category
  startDate?: Date;
  endDate?: Date;
  documentsRequired?: string[];
  documentDownloadLinks?: string[]; // Multiple possible
  consignees?: string[]; // Extracted consignee addresses
  createdAt: Date;
  updatedAt: Date;
}

const TenderSchema: Schema = new Schema(
  {
    tenderNo: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: false, index: true },
    category: { type: String, required: false, index: true },
    startDate: { type: Date, required: false },
    endDate: { type: Date, required: false },
    documentsRequired: { type: [String], default: [] },
    documentDownloadLinks: { type: [String], default: [] },
    consignees: { type: [String], default: [] },
  },
  {
    timestamps: true, // adds createdAt & updatedAt automatically
  }
);

export default mongoose.model<ITender>("Tender", TenderSchema);
