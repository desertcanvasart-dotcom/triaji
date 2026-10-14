'use client';

import { createContext, useContext } from 'react';

/**
 * How the doctor portal is being shown: as the doctor, or as their assistant
 * (a real assistant session, or the doctor previewing the assistant's view).
 * Screens use it to hide doctor-only actions; the server enforces the real
 * access rules either way.
 */
export interface DoctorView {
  role: 'doctor' | 'assistant';
  /** True when a doctor is only previewing the assistant view. */
  preview: boolean;
}

const DoctorViewContext = createContext<DoctorView | null>(null);

export const DoctorViewProvider = DoctorViewContext.Provider;

export function useDoctorView(): DoctorView | null {
  return useContext(DoctorViewContext);
}

/** sessionStorage key for the doctor's "view as assistant" preview. */
export const ASSISTANT_PREVIEW_KEY = 'doctortrio-assistant-preview';
