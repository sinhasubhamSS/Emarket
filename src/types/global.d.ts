declare module "pdf-parse" {
  interface PDFInfo {
    numpages: number;
    numrender: number;
    info: Record<string, any>;
    metadata: Record<string, any>;
    text: string;
    version: string;
  }

  function pdf(dataBuffer: Buffer): Promise<PDFInfo>;

  export = pdf;
}
