import { PDFPage, rgb } from 'pdf-lib';
import type { EmbeddedFonts } from './generator';
import {
  MARGIN,
  NAVY,
  TEAL,
  DARK_GRAY,
  LIGHT_GRAY,
  drawArabicText,
  drawSeparator,
  drawSectionHeader,
  drawBilingualText,
  wrapText,
} from './generator';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PrescriptionData {
  diagnosis_ar?: string;
  diagnosis_en?: string;
  medications: Array<{
    drug_name_ar: string;
    drug_name_en?: string;
    dose: string;
    route?: string;
    frequency_ar: string;
    frequency_en?: string;
    duration_ar?: string;
    duration_en?: string;
    instructions_ar?: string;
    instructions_en?: string;
  }>;
  pharmacist_notes?: string;
  followup_text?: string;
}

// ─── Layout ──────────────────────────────────────────────────────────────────

export function drawPrescriptionBody(
  page: PDFPage,
  data: PrescriptionData,
  startY: number,
  fonts: EmbeddedFonts,
  pageWidth: number
): number {
  let y = startY;
  const rightX = pageWidth - MARGIN;
  const colWidth = (pageWidth - MARGIN * 2 - 20) / 2;

  // ── Diagnosis ──────────────────────────────────────────────────────────────
  if (data.diagnosis_ar || data.diagnosis_en) {
    y = drawSectionHeader(page, 'التشخيص', 'Diagnosis', y, fonts);
    y = drawBilingualText(page, data.diagnosis_ar, data.diagnosis_en, y, fonts, pageWidth);
    y -= 8;
    drawSeparator(page, y);
    y -= 14;
  }

  // ── Medications ────────────────────────────────────────────────────────────
  y = drawSectionHeader(page, 'الأدوية', 'Medications', y, fonts);
  y -= 4;

  for (let i = 0; i < data.medications.length; i++) {
    const med = data.medications[i]!;
    const num = `${i + 1}.`;

    // Drug name line — numbered
    // English side
    const enName = med.drug_name_en ? `${num} ${med.drug_name_en}` : num;
    page.drawText(enName, {
      x: MARGIN,
      y,
      size: 10,
      font: fonts.bold,
      color: NAVY,
    });

    // Arabic side
    const arName = `${med.drug_name_ar} .${i + 1}`;
    drawArabicText(page, arName, rightX, y, fonts.bold, 10, NAVY);
    y -= 14;

    // Dose + Route
    const doseRoute = med.route ? `${med.dose} — ${med.route}` : med.dose;
    page.drawText(doseRoute, {
      x: MARGIN + 14,
      y,
      size: 9,
      font: fonts.regular,
      color: DARK_GRAY,
    });
    drawArabicText(page, doseRoute, rightX, y, fonts.regular, 9, DARK_GRAY);
    y -= 14;

    // Frequency
    if (med.frequency_en) {
      page.drawText(med.frequency_en, {
        x: MARGIN + 14,
        y,
        size: 9,
        font: fonts.regular,
        color: DARK_GRAY,
      });
    }
    drawArabicText(page, med.frequency_ar, rightX, y, fonts.regular, 9, DARK_GRAY);
    y -= 14;

    // Duration
    if (med.duration_ar || med.duration_en) {
      if (med.duration_en) {
        page.drawText(`Duration: ${med.duration_en}`, {
          x: MARGIN + 14,
          y,
          size: 9,
          font: fonts.regular,
          color: DARK_GRAY,
        });
      }
      if (med.duration_ar) {
        drawArabicText(page, `المدة: ${med.duration_ar}`, rightX, y, fonts.regular, 9, DARK_GRAY);
      }
      y -= 14;
    }

    // Instructions
    if (med.instructions_ar || med.instructions_en) {
      if (med.instructions_en) {
        const lines = wrapText(med.instructions_en, fonts.regular, 8, colWidth - 14);
        for (const line of lines) {
          page.drawText(line, {
            x: MARGIN + 14,
            y,
            size: 8,
            font: fonts.regular,
            color: rgb(0.4, 0.4, 0.4),
          });
          y -= 12;
        }
      }
      if (med.instructions_ar) {
        let arInstrY = med.instructions_en ? y + 12 : y;
        const lines = wrapText(med.instructions_ar, fonts.regular, 8, colWidth);
        for (const line of lines) {
          drawArabicText(page, line, rightX, arInstrY, fonts.regular, 8, rgb(0.4, 0.4, 0.4));
          arInstrY -= 12;
        }
        y = Math.min(y, arInstrY);
      }
      if (!med.instructions_en) {
        y -= 12;
      }
    }

    // Thin separator between medications
    if (i < data.medications.length - 1) {
      y -= 2;
      page.drawLine({
        start: { x: MARGIN + 14, y },
        end: { x: pageWidth - MARGIN - 14, y },
        thickness: 0.3,
        color: LIGHT_GRAY,
      });
      y -= 10;
    }
  }

  y -= 8;
  drawSeparator(page, y);
  y -= 14;

  // ── Pharmacist Notes ───────────────────────────────────────────────────────
  if (data.pharmacist_notes) {
    y = drawSectionHeader(page, 'ملاحظات للصيدلي', 'Pharmacist Notes', y, fonts);
    const lines = wrapText(data.pharmacist_notes, fonts.regular, 9, pageWidth - MARGIN * 2);
    for (const line of lines) {
      page.drawText(line, {
        x: MARGIN,
        y,
        size: 9,
        font: fonts.regular,
        color: DARK_GRAY,
      });
      y -= 14;
    }
    y -= 8;
    drawSeparator(page, y);
    y -= 14;
  }

  // ── Follow-up ──────────────────────────────────────────────────────────────
  if (data.followup_text) {
    y = drawSectionHeader(page, 'المتابعة', 'Follow-up', y, fonts);
    const lines = wrapText(data.followup_text, fonts.regular, 9, pageWidth - MARGIN * 2);
    for (const line of lines) {
      page.drawText(line, {
        x: MARGIN,
        y,
        size: 9,
        font: fonts.regular,
        color: DARK_GRAY,
      });
      y -= 14;
    }
    y -= 8;
  }

  return y;
}
