import { getMemberRoutine } from "../services/routines.service";

export function useMemberRoutine() {
  async function loadRoutine(memberId) {
    return getMemberRoutine(memberId);
  }

  return {
    loadRoutine,
  };
}