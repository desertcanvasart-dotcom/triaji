import { PDFDocument, PDFPage, PDFFont, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { readFileSync } from 'fs';
import { join } from 'path';
import { drawPrescriptionBody } from './prescription';
import { drawLabOrderBody } from './lab-order';
import { drawImagingOrderBody } from './imaging-order';
import { drawConsultationBody } from './consultation-summary';
import type { PrescriptionData } from './prescription';
import type { LabOrderData } from './lab-order';
import type { ImagingOrderData } from './imaging-order';
import type { ConsultationSummaryData } from './consultation-summary';

// ─── Constants ───────────────────────────────────────────────────────────────

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const NAVY = rgb(0.102, 0.184, 0.290);
const TEAL = rgb(0.051, 0.478, 0.478);
const DARK_GRAY = rgb(0.2, 0.2, 0.2);
const LIGHT_GRAY = rgb(0.75, 0.75, 0.75);
const DISCLAIMER_AR = 'هذه الوثيقة صادرة من الطبيب المعالج وليست توصية من ترياڃي';
const DISCLAIMER_EN = 'This document is issued by the treating physician and is not a Triajji recommendation';

const DOCUMENT_TITLES: Record<DocumentType, { ar: string; en: string }> = {
  prescription: { ar: 'روشتة طبية', en: 'Medical Prescription' },
  lab_order: { ar: 'طلب تحاليل', en: 'Laboratory Order' },
  imaging_order: { ar: 'طلب أشعة', en: 'Imaging Order' },
  consultation_summary: { ar: 'ملخص الكشف', en: 'Consultation Summary' },
};

// ─── Types ───────────────────────────────────────────────────────────────────

export type DocumentType = 'prescription' | 'lab_order' | 'imaging_order' | 'consultation_summary';

export interface DoctorAssets {
  name_ar: string;
  name_en: string | null;
  specialty_ar: string;
  syndicate_number: string;
  clinic_name_ar: string | null;
  clinic_name_en: string | null;
  clinic_address_ar: string | null;
  clinic_address_en: string | null;
  clinic_phone: string | null;
  signature_url: string | null;
  stamp_url: string | null;
  use_text_stamp: boolean;
}

export interface DocumentMeta {
  document_number: string;
  date: Date;
  patient_name: string | null;
  patient_age: number | null;
}

export interface EmbeddedFonts {
  regular: PDFFont;
  bold: PDFFont;
}

export type DocumentData =
  | PrescriptionData
  | LabOrderData
  | ImagingOrderData
  | ConsultationSummaryData;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Wraps text to fit within a given max width, splitting at word boundaries.
 * Returns an array of lines.
 */
export function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);
    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

/**
 * Draws Arabic text right-aligned within the right column.
 */
export function drawArabicText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  color = DARK_GRAY
): void {
  const textWidth = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: x - textWidth, y, size, font, color });
}

/**
 * Draws a horizontal separator line.
 */
export function drawSeparator(page: PDFPage, y: number): void {
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 0.5,
    color: LIGHT_GRAY,
  });
}

/**
 * Draws a section header with bilingual text.
 */
export function drawSectionHeader(
  page: PDFPage,
  titleAr: string,
  titleEn: string,
  y: number,
  fonts: EmbeddedFonts
): number {
  // English on the left
  page.drawText(titleEn, {
    x: MARGIN,
    y,
    size: 11,
    font: fonts.bold,
    color: NAVY,
  });
  // Arabic on the right
  drawArabicText(page, titleAr, PAGE_WIDTH - MARGIN, y, fonts.bold, 11, NAVY);
  return y - 18;
}

/**
 * Draws wrapped bilingual body text. Arabic right-aligned, English left-aligned.
 * Returns the new Y position after drawing.
 */
export function drawBilingualText(
  page: PDFPage,
  textAr: string | undefined,
  textEn: string | undefined,
  y: number,
  fonts: EmbeddedFonts,
  pageWidth: number
): number {
  const fontSize = 9;
  const lineHeight = 14;
  const colWidth = (pageWidth - MARGIN * 2 - 20) / 2;
  let currentY = y;

  if (textEn) {
    const lines = wrapText(textEn, fonts.regular, fontSize, colWidth);
    for (const line of lines) {
      page.drawText(line, { x: MARGIN, y: currentY, size: fontSize, font: fonts.regular, color: DARK_GRAY });
      currentY -= lineHeight;
    }
  }

  let arY = y;
  if (textAr) {
    const lines = wrapText(textAr, fonts.regular, fontSize, colWidth);
    for (const line of lines) {
      drawArabicText(page, line, pageWidth - MARGIN, arY, fonts.regular, fontSize, DARK_GRAY);
      arY -= lineHeight;
    }
  }

  return Math.min(currentY, arY);
}

/**
 * Formats a date as dd/mm/yyyy.
 */
function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// ─── Header ──────────────────────────────────────────────────────────────────

function drawHeader(
  page: PDFPage,
  doctor: DoctorAssets,
  meta: DocumentMeta,
  fonts: EmbeddedFonts,
  docType: DocumentType
): number {
  let y = PAGE_HEIGHT - MARGIN;

  // Doctor name — Arabic right, English left
  if (doctor.name_en) {
    page.drawText(doctor.name_en, {
      x: MARGIN,
      y,
      size: 14,
      font: fonts.bold,
      color: NAVY,
    });
  }
  drawArabicText(page, doctor.name_ar, PAGE_WIDTH - MARGIN, y, fonts.bold, 14, NAVY);
  y -= 18;

  // Specialty + Syndicate number
  const syndicateText = `نقابة الأطباء: ${doctor.syndicate_number}`;
  drawArabicText(page, doctor.specialty_ar, PAGE_WIDTH - MARGIN, y, fonts.regular, 10, DARK_GRAY);
  page.drawText(`Syndicate #${doctor.syndicate_number}`, {
    x: MARGIN,
    y,
    size: 9,
    font: fonts.regular,
    color: DARK_GRAY,
  });
  y -= 14;

  drawArabicText(page, syndicateText, PAGE_WIDTH - MARGIN, y, fonts.regular, 9, DARK_GRAY);
  y -= 16;

  // Clinic info
  if (doctor.clinic_name_ar || doctor.clinic_name_en) {
    if (doctor.clinic_name_en) {
      page.drawText(doctor.clinic_name_en, {
        x: MARGIN,
        y,
        size: 10,
        font: fonts.bold,
        color: DARK_GRAY,
      });
    }
    if (doctor.clinic_name_ar) {
      drawArabicText(page, doctor.clinic_name_ar, PAGE_WIDTH - MARGIN, y, fonts.bold, 10, DARK_GRAY);
    }
    y -= 14;
  }

  if (doctor.clinic_address_ar || doctor.clinic_address_en) {
    if (doctor.clinic_address_en) {
      page.drawText(doctor.clinic_address_en, {
        x: MARGIN,
        y,
        size: 8,
        font: fonts.regular,
        color: DARK_GRAY,
      });
    }
    if (doctor.clinic_address_ar) {
      drawArabicText(page, doctor.clinic_address_ar, PAGE_WIDTH - MARGIN, y, fonts.regular, 8, DARK_GRAY);
    }
    y -= 14;
  }

  if (doctor.clinic_phone) {
    page.drawText(`Tel: ${doctor.clinic_phone}`, {
      x: MARGIN,
      y,
      size: 8,
      font: fonts.regular,
      color: DARK_GRAY,
    });
    y -= 14;
  }

  // Separator after doctor info
  drawSeparator(page, y);
  y -= 16;

  // Document title
  const title = DOCUMENT_TITLES[docType];
  page.drawText(title.en, {
    x: MARGIN,
    y,
    size: 13,
    font: fonts.bold,
    color: TEAL,
  });
  drawArabicText(page, title.ar, PAGE_WIDTH - MARGIN, y, fonts.bold, 13, TEAL);
  y -= 20;

  // Document number + Date
  const dateStr = formatDate(meta.date);
  page.drawText(`No: ${meta.document_number}`, {
    x: MARGIN,
    y,
    size: 9,
    font: fonts.regular,
    color: DARK_GRAY,
  });
  drawArabicText(page, `التاريخ: ${dateStr}`, PAGE_WIDTH - MARGIN, y, fonts.regular, 9, DARK_GRAY);
  y -= 16;

  // Patient info
  if (meta.patient_name) {
    page.drawText(`Patient: ${meta.patient_name}`, {
      x: MARGIN,
      y,
      size: 9,
      font: fonts.regular,
      color: DARK_GRAY,
    });
    drawArabicText(page, `المريض: ${meta.patient_name}`, PAGE_WIDTH - MARGIN, y, fonts.regular, 9, DARK_GRAY);
    y -= 14;
  }

  if (meta.patient_age !== null) {
    page.drawText(`Age: ${meta.patient_age}`, {
      x: MARGIN,
      y,
      size: 9,
      font: fonts.regular,
      color: DARK_GRAY,
    });
    drawArabicText(page, `العمر: ${meta.patient_age}`, PAGE_WIDTH - MARGIN, y, fonts.regular, 9, DARK_GRAY);
    y -= 14;
  }

  // Separator after patient info
  drawSeparator(page, y);
  y -= 16;

  return y;
}

// ─── Signature ───────────────────────────────────────────────────────────────

async function drawSignature(
  page: PDFPage,
  pdfDoc: PDFDocument,
  doctor: DoctorAssets,
  y: number,
  fonts: EmbeddedFonts
): Promise<number> {
  let currentY = y - 20;

  // Signature image if available
  if (doctor.signature_url) {
    try {
      const response = await fetch(doctor.signature_url);
      const sigBytes = new Uint8Array(await response.arrayBuffer());
      const isPng = doctor.signature_url.toLowerCase().endsWith('.png');
      const sigImage = isPng
        ? await pdfDoc.embedPng(sigBytes)
        : await pdfDoc.embedJpg(sigBytes);
      const sigDims = sigImage.scale(0.5);
      const sigWidth = Math.min(sigDims.width, 120);
      const sigHeight = (sigWidth / sigDims.width) * sigDims.height;

      page.drawImage(sigImage, {
        x: PAGE_WIDTH - MARGIN - sigWidth,
        y: currentY - sigHeight,
        width: sigWidth,
        height: sigHeight,
      });
      currentY -= sigHeight + 4;
    } catch {
      // Signature image failed to load; skip it
    }
  }

  // Stamp image or text stamp
  if (doctor.stamp_url && !doctor.use_text_stamp) {
    try {
      const response = await fetch(doctor.stamp_url);
      const stampBytes = new Uint8Array(await response.arrayBuffer());
      const isPng = doctor.stamp_url.toLowerCase().endsWith('.png');
      const stampImage = isPng
        ? await pdfDoc.embedPng(stampBytes)
        : await pdfDoc.embedJpg(stampBytes);
      const stampDims = stampImage.scale(0.4);
      const stampWidth = Math.min(stampDims.width, 100);
      const stampHeight = (stampWidth / stampDims.width) * stampDims.height;

      page.drawImage(stampImage, {
        x: PAGE_WIDTH - MARGIN - stampWidth,
        y: currentY - stampHeight,
        width: stampWidth,
        height: stampHeight,
      });
      currentY -= stampHeight + 4;
    } catch {
      // Stamp image failed to load; fall through to text stamp
      doctor.use_text_stamp = true;
    }
  }

  if (doctor.use_text_stamp || !doctor.stamp_url) {
    // Signature line
    page.drawLine({
      start: { x: PAGE_WIDTH - MARGIN - 150, y: currentY },
      end: { x: PAGE_WIDTH - MARGIN, y: currentY },
      thickness: 0.5,
      color: DARK_GRAY,
    });
    currentY -= 14;

    drawArabicText(page, doctor.name_ar, PAGE_WIDTH - MARGIN, currentY, fonts.bold, 10, NAVY);
    currentY -= 12;
    drawArabicText(page, doctor.specialty_ar, PAGE_WIDTH - MARGIN, currentY, fonts.regular, 8, DARK_GRAY);
    currentY -= 12;
    drawArabicText(
      page,
      `نقابة الأطباء: ${doctor.syndicate_number}`,
      PAGE_WIDTH - MARGIN,
      currentY,
      fonts.regular,
      8,
      DARK_GRAY
    );
    currentY -= 14;
  }

  return currentY;
}

// ─── Disclaimer ──────────────────────────────────────────────────────────────

function drawDisclaimer(page: PDFPage, y: number, fonts: EmbeddedFonts): void {
  const disclaimerY = Math.min(y - 10, MARGIN + 30);

  drawSeparator(page, disclaimerY + 14);

  // Arabic disclaimer — right aligned
  drawArabicText(page, DISCLAIMER_AR, PAGE_WIDTH - MARGIN, disclaimerY, fonts.regular, 7, LIGHT_GRAY);

  // English disclaimer — left aligned
  page.drawText(DISCLAIMER_EN, {
    x: MARGIN,
    y: disclaimerY - 10,
    size: 7,
    font: fonts.regular,
    color: LIGHT_GRAY,
  });
}

// ─── Main Generator ──────────────────────────────────────────────────────────

export async function generateClinicalPDF(
  type: DocumentType,
  data: DocumentData,
  doctor: DoctorAssets,
  meta: DocumentMeta
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // Load and embed Cairo fonts
  const regularFontPath = join(process.cwd(), 'public', 'fonts', 'Cairo-Regular.ttf');
  const boldFontPath = join(process.cwd(), 'public', 'fonts', 'Cairo-Bold.ttf');
  const regularFontBytes = readFileSync(regularFontPath);
  const boldFontBytes = readFileSync(boldFontPath);

  const regular = await pdfDoc.embedFont(regularFontBytes, { subset: false });
  const bold = await pdfDoc.embedFont(boldFontBytes, { subset: false });
  const fonts: EmbeddedFonts = { regular, bold };

  // Create page
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  // Draw header
  let y = drawHeader(page, doctor, meta, fonts, type);

  // Draw body based on type
  switch (type) {
    case 'prescription':
      y = drawPrescriptionBody(page, data as PrescriptionData, y, fonts, PAGE_WIDTH);
      break;
    case 'lab_order':
      y = drawLabOrderBody(page, data as LabOrderData, y, fonts, PAGE_WIDTH);
      break;
    case 'imaging_order':
      y = drawImagingOrderBody(page, data as ImagingOrderData, y, fonts, PAGE_WIDTH);
      break;
    case 'consultation_summary':
      y = drawConsultationBody(page, data as ConsultationSummaryData, y, fonts, PAGE_WIDTH);
      break;
  }

  // Draw signature
  y = await drawSignature(page, pdfDoc, doctor, y, fonts);

  // Draw disclaimer
  drawDisclaimer(page, y, fonts);

  return pdfDoc.save();
}

export { PAGE_WIDTH, PAGE_HEIGHT, MARGIN, CONTENT_WIDTH, NAVY, TEAL, DARK_GRAY, LIGHT_GRAY };
