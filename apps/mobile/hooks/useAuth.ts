/**
 * Auth Hook — manages authentication state via MMKV storage.
 * Supports both patient and doctor modes.
 */

import { useState, useCallback } from 'react';
import { router } from 'expo-router';
import {
  isAuthenticated as checkAuth,
  setPatientToken,
  clearPatientToken,
  setPatientName,
  setPatientId,
  getPatientName,
  getPatientId,
  isDoctorAuthenticated as checkDoctorAuth,
  setDoctorToken,
  setDoctorId,
  setDoctorName,
  setDoctorSyndicate,
  getDoctorName,
  getDoctorId,
  getDoctorSyndicate,
  clearDoctorData,
  isDoctorMode as checkDoctorMode,
  setDoctorMode as storeDoctorMode,
} from '@/lib/storage';

interface DoctorData {
  id: string;
  name: string;
  syndicateNumber: string;
}

export function useAuth() {
  const [authenticated, setAuthenticated] = useState(checkAuth());
  const [doctorAuthenticated, setDoctorAuthenticated] = useState(checkDoctorAuth());
  const [inDoctorMode, setInDoctorMode] = useState(checkDoctorMode());

  // ─── Patient auth ────────────────────────────────────────────────────────

  const login = useCallback(
    (token: string, patientId: string, nameAr: string) => {
      setPatientToken(token);
      setPatientId(patientId);
      setPatientName(nameAr);
      setAuthenticated(true);
      router.replace('/(patient)/chat');
    },
    []
  );

  const logout = useCallback(() => {
    clearPatientToken();
    setAuthenticated(false);
    router.replace('/(auth)');
  }, []);

  const skipLogin = useCallback(() => {
    router.replace('/(patient)/chat');
  }, []);

  // ─── Doctor auth ─────────────────────────────────────────────────────────

  const loginAsDoctor = useCallback(
    (token: string, doctorData: DoctorData) => {
      setDoctorToken(token);
      setDoctorId(doctorData.id);
      setDoctorName(doctorData.name);
      setDoctorSyndicate(doctorData.syndicateNumber);
      storeDoctorMode(true);
      setDoctorAuthenticated(true);
      setInDoctorMode(true);
      router.replace('/(doctor)');
    },
    []
  );

  const logoutDoctor = useCallback(() => {
    clearDoctorData();
    setDoctorAuthenticated(false);
    setInDoctorMode(false);
    router.replace('/(auth)');
  }, []);

  const switchToPatientMode = useCallback(() => {
    storeDoctorMode(false);
    setInDoctorMode(false);
    router.replace('/(auth)');
  }, []);

  return {
    // Patient
    authenticated,
    patientName: getPatientName(),
    patientId: getPatientId(),
    login,
    logout,
    skipLogin,

    // Doctor
    doctorAuthenticated,
    isDoctorMode: inDoctorMode,
    doctorName: getDoctorName(),
    doctorId: getDoctorId(),
    doctorSyndicate: getDoctorSyndicate(),
    loginAsDoctor,
    logoutDoctor,
    switchToPatientMode,
  };
}
