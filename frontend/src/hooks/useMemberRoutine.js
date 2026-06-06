import {
  getMemberRoutine,
  getMemberWhatsapp,
} from "../services/routines.service";

export function useMemberRoutine() {
  async function loadRoutine(memberId) {
    return getMemberRoutine(memberId);
  }

  async function loadWhatsapp(memberId) {
    return getMemberWhatsapp(memberId);
  }

  return {
    loadRoutine,
    loadWhatsapp,
  };
}