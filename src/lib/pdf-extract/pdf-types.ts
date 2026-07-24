import { getDocumentProxy, getResolvedPDFJS } from "unpdf";

// unpdf doesn't publicly re-export PDFDocumentProxy/page/pdfjs-module types
// by name (only StructuredTextItem) — derive them from its own function
// signatures instead of using `any` throughout this module.
export type PdfDocument = Awaited<ReturnType<typeof getDocumentProxy>>;
export type PdfJsModule = Awaited<ReturnType<typeof getResolvedPDFJS>>;
export type PdfPage = Awaited<ReturnType<PdfDocument["getPage"]>>;
