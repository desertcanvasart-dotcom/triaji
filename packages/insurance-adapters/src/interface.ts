export interface PolicyVerificationResult {
  isValid: boolean;
  status: 'active' | 'suspended' | 'expired' | 'not_found';
  coverageEnd?: string;
  annualLimit?: number;
  copayPct?: number;
  memberName?: string;
}

export interface PreAuthSubmissionResult {
  accepted: boolean;
  referenceId?: string;
  estimatedResponseHours?: number;
  message?: string;
}

export interface PreAuthStatusResult {
  status: 'pending' | 'approved' | 'denied' | 'partial';
  approvedAmount?: number;
  reference?: string;
  validUntil?: string;
  denialReason?: string;
}

export interface ClaimSubmissionResult {
  accepted: boolean;
  claimReference?: string;
  message?: string;
}

export interface ClaimStatusResult {
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  approvedAmount?: number;
  paidAt?: string;
  rejectionReason?: string;
}

export interface InsuranceAdapter {
  verifyPolicy(policyNumber: string, cardNumber?: string): Promise<PolicyVerificationResult>;
  submitPreAuth(request: Record<string, unknown>): Promise<PreAuthSubmissionResult>;
  checkPreAuthStatus(referenceId: string): Promise<PreAuthStatusResult>;
  submitClaim(claim: Record<string, unknown>): Promise<ClaimSubmissionResult>;
  checkClaimStatus(claimNumber: string): Promise<ClaimStatusResult>;
}
