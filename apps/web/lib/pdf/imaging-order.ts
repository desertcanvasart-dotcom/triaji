import { PDFPage, rgb } from 'pdf-lib';
import type { EmbeddedFonts } from './generator';
import {
  MARGIN,
  NAVY,
  DARK_GRAY,
  LIGHT_GRAY,
  drawArabicText,
  drawSeparator,
  drawSectionHeader,
  drawBilingualText,
  wrapText,
} from './generator';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ImagingOrderData {
  clinical_indication_ar?: string;
  clinical_indication_en?: string;
  examinations: Array<{
    modality: string;
    modality_ar: string;
    body_region_ar: string;
    body_region_en?: string;
    laterality?: string;
    contrast: boolean;
    urgency: 'routine' | 'urgent';
    clinical_indication_ar?: string;
  }>;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const URGENT_COLOR = rgb(0.8, 0.15, 0.15);
const CONTRAST_COLOR = rgb(0.2, 0.45, 0.7);

// ─── Layout ──────────────────────────────────────────────────────────────────

export function drawImagingOrderBody(
  page: PDFPage,
  data: ImagingOrderData,
  startY: number,
  fonts: EmbeddedFonts,
  pageWidth: number
): number {
  let y = startY;
  const rightX = pageWidth - MARGIN;
  const colWidth = (pageWidth - MARGIN * 2 - 20) / 2;

  // ── Clinical Indication ────────────────────────────────────────────────────
  if (data.clinical_indication_ar || data.clinical_indication_en) {
    y = drawSectionHeader(page, 'الدواعي السريرية', 'Clinical Indication', y, fonts);
    y = drawBilingualText(
      page,
      data.clinical_indication_ar,
      data.clinical_indication_en,
      y,
      fonts,
      pageWidth
    );
    y -= 8;
    drawSeparator(page, y);
    y -= 14;
  }

  // ── Examinations ───────────────────────────────────────────────────────────
  y = drawSectionHeader(page, 'الفحوصات المطلوبة', 'Requested Examinations', y, fonts);
  y -= 4;

  for (let i = 0; i < data.examinations.length; i++) {
    const exam = data.examinations[i]!;

    // Exam number
    const numStr = `${i + 1}.`;

    // Modality + body region — English left
    const enModality = `${numStr} ${exam.modality}`;
    const enRegion = exam.body_region_en ? ` — ${exam.body_region_en}` : '';
    const enLaterality = exam.laterality ? ` (${exam.laterality})` : '';
    page.drawText(`${enModality}${enRegion}${enLaterality}`, {
      x: MARGIN,
      y,
      size: 10,
      font: fonts.bold,
      color: NAVY,
    });

    // Arabic — modality + body region — right aligned
    const arLabel = `${exam.modality_ar} — ${exam.body_region_ar}`;
    const arWithLat = exam.laterality ? `${arLabel} (${exam.laterality})` : arLabel;
    drawArabicText(page, `${arWithLat} .${i + 1}`, rightX, y, fonts.bold, 10, NAVY);
    y -= 16;

    // Badges
    const badges: Array<{ text: string; color: typeof URGENT_COLOR }> = [];

    if (exam.urgency === 'urgent') {
      badges.push({ text: 'URGENT / عاجل', color: URGENT_COLOR });
    }
    if (exam.contrast) {
      badges.push({ text: 'WITH CONTRAST / بالصبغة', color: CONTRAST_COLOR });
    }

    if (badges.length > 0) {
      let badgeX = MARGIN;
      for (const badge of badges) {
        const badgeWidth = fonts.bold.widthOfTextAtSize(badge.text, 7) + 10;

        page.drawRectangle({
          x: badgeX,
          y: y - 2,
          width: badgeWidth,
          height: 12,
          color: badge.color,
          borderWidth: 0,
        });

        page.drawText(badge.text, {
          x: badgeX + 5,
          y: y + 1,
          size: 7,
          font: fonts.bold,
          color: rgb(1, 1, 1),
        });

        badgeX += badgeWidth + 6;
      }
      y -= 16;
    }

    // Per-exam clinical indication
    if (exam.clinical_indication_ar) {
      const lines = wrapText(exam.clinical_indication_ar, fonts.regular, 8, colWidth);
      for (const line of lines) {
        drawArabicText(page, line, rightX, y, fonts.regular, 8, rgb(0.4, 0.4, 0.4));
        y -= 12;
      }
    }

    // Separator between examinations
    if (i < data.examinations.length - 1) {
      y -= 2;
      page.drawLine({
        start: { x: MARGIN + 10, y },
        end: { x: pageWidth - MARGIN - 10, y },
        thickness: 0.3,
        color: LIGHT_GRAY,
      });
      y -= 10;
    }
  }

  y -= 8;
  drawSeparator(page, y);
  y -= 14;

  // ── Summary line ───────────────────────────────────────────────────────────
  const totalExams = data.examinations.length;
  const urgentCount = data.examinations.filter((e) => e.urgency === 'urgent').length;
  const contrastCount = data.examinations.filter((e) => e.contrast).length;

  const summaryEn = `Total: ${totalExams} exam(s) | Urgent: ${urgentCount} | With contrast: ${contrastCount}`;
  const summaryAr = `المجموع: ${totalExams} فحص | عاجل: ${urgentCount} | بالصبغة: ${contrastCount}`;

  page.drawText(summaryEn, {
    x: MARGIN,
    y,
    size: 8,
    font: fonts.regular,
    color: DARK_GRAY,
  });
  drawArabicText(page, summaryAr, rightX, y, fonts.regular, 8, DARK_GRAY);
  y -= 16;

  return y;
}
