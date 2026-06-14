import { PDFPage } from 'pdf-lib';
import type { EmbeddedFonts } from './generator';
import {
  drawSeparator,
  drawSectionHeader,
  drawBilingualText,
} from './generator';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ConsultationSummaryData {
  history_ar?: string;
  history_en?: string;
  examination_ar?: string;
  examination_en?: string;
  assessment_ar?: string;
  assessment_en?: string;
  plan_ar?: string;
  plan_en?: string;
  followup_ar?: string;
}

// ─── Layout Helpers ──────────────────────────────────────────────────────────

interface SectionDef {
  titleAr: string;
  titleEn: string;
  textAr?: string;
  textEn?: string;
}

function drawSection(
  page: PDFPage,
  section: SectionDef,
  y: number,
  fonts: EmbeddedFonts,
  pageWidth: number
): number {
  if (!section.textAr && !section.textEn) {
    return y;
  }

  let currentY = drawSectionHeader(page, section.titleAr, section.titleEn, y, fonts);
  currentY = drawBilingualText(page, section.textAr, section.textEn, currentY, fonts, pageWidth);
  currentY -= 8;
  drawSeparator(page, currentY);
  currentY -= 14;

  return currentY;
}

// ─── Layout ──────────────────────────────────────────────────────────────────

export function drawConsultationBody(
  page: PDFPage,
  data: ConsultationSummaryData,
  startY: number,
  fonts: EmbeddedFonts,
  pageWidth: number
): number {
  let y = startY;

  const sections: SectionDef[] = [
    {
      titleAr: 'التاريخ المرضي',
      titleEn: 'History',
      textAr: data.history_ar,
      textEn: data.history_en,
    },
    {
      titleAr: 'الفحص السريري',
      titleEn: 'Examination',
      textAr: data.examination_ar,
      textEn: data.examination_en,
    },
    {
      titleAr: 'التقييم',
      titleEn: 'Assessment',
      textAr: data.assessment_ar,
      textEn: data.assessment_en,
    },
    {
      titleAr: 'الخطة العلاجية',
      titleEn: 'Plan',
      textAr: data.plan_ar,
      textEn: data.plan_en,
    },
  ];

  for (const section of sections) {
    y = drawSection(page, section, y, fonts, pageWidth);
  }

  // Follow-up (Arabic only, since the interface only has followup_ar)
  if (data.followup_ar) {
    y = drawSectionHeader(page, 'المتابعة', 'Follow-up', y, fonts);
    y = drawBilingualText(page, data.followup_ar, undefined, y, fonts, pageWidth);
    y -= 8;
    drawSeparator(page, y);
    y -= 14;
  }

  return y;
}
