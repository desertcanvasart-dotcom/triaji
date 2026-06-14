/**
 * DTMF (Dual-Tone Multi-Frequency) Handler
 * Maps phone keypad presses to actions based on the current call state.
 *
 * Initial Menu (before voice triage starts):
 *   1 = Start voice triage with AI assistant
 *   2 = Request human agent handoff
 *   9 = Repeat the menu
 *
 * Mid-Call (during voice triage conversation):
 *   0 = Request transfer to human agent
 *   9 = Repeat last AI response
 *   # = Confirm yes (useful for booking confirmation)
 *   * = Hang up / end call
 *
 * All other digits are ignored.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DTMFAction {
  type: 'repeat_last' | 'confirm_yes' | 'request_handoff' | 'hangup' | 'start_voice' | 'ignored';
}

export interface PhoneMenuState {
  /** True when the caller is still in the initial DTMF menu */
  inMenu: boolean;
  /** True when the caller is in the voice triage conversation */
  inTriage: boolean;
}

// ─── DTMF Handler ───────────────────────────────────────────────────────────

export class DTMFHandler {
  /**
   * Map a DTMF digit to an action based on the current phone menu state.
   *
   * @param digit The DTMF digit pressed ('0'-'9', '*', '#')
   * @param state The current state of the phone call
   * @returns The action to take in response to the digit
   */
  handle(digit: string, state: PhoneMenuState): DTMFAction {
    // ─── Initial Menu ─────────────────────────────────────────────────
    if (state.inMenu && !state.inTriage) {
      switch (digit) {
        case '1':
          return { type: 'start_voice' };
        case '2':
          return { type: 'request_handoff' };
        case '9':
          return { type: 'repeat_last' };
        default:
          return { type: 'ignored' };
      }
    }

    // ─── Mid-Call (Voice Triage) ──────────────────────────────────────
    if (state.inTriage) {
      switch (digit) {
        case '0':
          return { type: 'request_handoff' };
        case '9':
          return { type: 'repeat_last' };
        case '#':
          return { type: 'confirm_yes' };
        case '*':
          return { type: 'hangup' };
        default:
          return { type: 'ignored' };
      }
    }

    // ─── Fallback (unexpected state) ──────────────────────────────────
    return { type: 'ignored' };
  }
}
