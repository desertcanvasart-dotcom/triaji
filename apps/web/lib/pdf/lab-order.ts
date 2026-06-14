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

export interface LabOrderData {
  clinical_indication_ar?: string;
  clinical_indication_en?: string;
  tests: Array<{
    test_name_ar: string;
    test_name_en?: string;
    urgency: 'routine' | 'urgent';
    fasting_required: boolean;
    notes_ar?: string;
  }>;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const URGENT_COLOR = rgb(0.8, 0.15, 0.15);
const FASTING_COLOR = rgb(0.75, 0.55, 0.0);
const CHECKBOX_SIZE = 8;

// ─── Layout ──────────────────────────────────────────────────────────────────

export function drawLabOrderBody(
  page: PDFPage,
  data: LabOrderData,
  startY: number,
  fonts: EmbeddedFonts,
  pageWidth: number
): number {
  let y = startY;
  const rightX = pageWidth - MARGIN;

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

  // ── Tests Checklist ────────────────────────────────────────────────────────
  y = drawSectionHeader(page, 'التحاليل المطلوبة', 'Requested Tests', y, fonts);
  y -= 4;

  for (let i = 0; i < data.tests.length; i++) {
    const test = data.tests[i]!;

    // Checkbox (empty square)
    page.drawRectangle({
      x: MARGIN,
      y: y - 1,
      width: CHECKBOX_SIZE,
      height: CHECKBOX_SIZE,
      borderColor: DARK_GRAY,
      borderWidth: 0.8,
      color: rgb(1, 1, 1),
    });

    // English test name
    const enLabel = test.test_name_en ?? '';
    if (enLabel) {
      page.drawText(enLabel, {
        x: MARGIN + CHECKBOX_SIZE + 6,
        y,
        size: 10,
        font: fonts.bold,
        color: NAVY,
      });
    }

    // Arabic test name — right aligned
    drawArabicText(page, test.test_name_ar, rightX, y, fonts.bold, 10, NAVY);
    y -= 14;

    // Badges line
    const badges: Array<{ text: string; color: typeof URGENT_COLOR }> = [];

    if (test.urgency === 'urgent') {
      badges.push({ text: 'URGENT / عاجل', color: URGENT_COLOR });
    }
    if (test.fasting_required) {
      badges.push({ text: 'FASTING / صائم', color: FASTING_COLOR });
    }

    if (badges.length > 0) {
      let badgeX = MARGIN + CHECKBOX_SIZE + 6;
      for (const badge of badges) {
        const badgeWidth = fonts.bold.widthOfTextAtSize(badge.text, 7) + 10;

        // Badge background
        page.drawRectangle({
          x: badgeX,
          y: y - 2,
          width: badgeWidth,
          height: 12,
          color: badge.color,
          borderWidth: 0,
        });

        // Badge text
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

    // Notes
    if (test.notes_ar) {
      const colWidth = (pageWidth - MARGIN * 2 - 20) / 2;
      const lines = wrapText(test.notes_ar, fonts.regular, 8, colWidth);
      for (const line of lines) {
        drawArabicText(page, line, rightX, y, fonts.regular, 8, rgb(0.4, 0.4, 0.4));
        y -= 12;
      }
    }

    // Thin separator between tests
    if (i < data.tests.length - 1) {
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
  const totalTests = data.tests.length;
  const urgentCount = data.tests.filter((t) => t.urgency === 'urgent').length;
  const fastingCount = data.tests.filter((t) => t.fasting_required).length;

  const summaryEn = `Total: ${totalTests} test(s) | Urgent: ${urgentCount} | Fasting: ${fastingCount}`;
  const summaryAr = `المجموع: ${totalTests} تحليل | عاجل: ${urgentCount} | صائم: ${fastingCount}`;

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
