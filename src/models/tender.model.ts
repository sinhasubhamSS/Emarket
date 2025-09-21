import mongoose, { Schema, Document } from "mongoose";

export interface ITender extends Document {
  tenderNo: string;
  title: string;
  category: string;
  startDate: Date;
  endDate: Date;
  documentsRequired: string[];
  documentDownloadLink: string;
  createdAt: Date;
  updatedAt: Date;
}

const TenderSchema: Schema = new Schema(
  {
    tenderNo: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    category: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    documentsRequired: { type: [String], default: [] },
    documentDownloadLink: { type: String, required: false },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<ITender>("Tender", TenderSchema);
