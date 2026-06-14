// TODO: Implement real API when insurer provides credentials

import type {
  InsuranceAdapter,
  PolicyVerificationResult,
  PreAuthSubmissionResult,
  PreAuthStatusResult,
  ClaimSubmissionResult,
  ClaimStatusResult,
} from '../interface';

export class MetLifeAdapter implements InsuranceAdapter {
  async verifyPolicy(
    _policyNumber: string,
    _cardNumber?: string
  ): Promise<PolicyVerificationResult> {
    return { isValid: true, status: 'active' };
  }

  async submitPreAuth(
    _request: Record<string, unknown>
  ): Promise<PreAuthSubmissionResult> {
    return { accepted: true, referenceId: 'MANUAL', estimatedResponseHours: 24 };
  }

  async checkPreAuthStatus(
    _referenceId: string
  ): Promise<PreAuthStatusResult> {
    return { status: 'pending' };
  }

  async submitClaim(
    _claim: Record<string, unknown>
  ): Promise<ClaimSubmissionResult> {
    return { accepted: true, claimReference: 'MANUAL' };
  }

  async checkClaimStatus(
    _claimNumber: string
  ): Promise<ClaimStatusResult> {
    return { status: 'pending' };
  }
}
