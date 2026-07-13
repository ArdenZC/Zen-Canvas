import { create } from "zustand";
import type { FileRecord, LibraryScope, OperationPreview } from "../types/domain";
import {
  buildOrganizeSuggestions,
  canSetOrganizeDecision,
  initialOrganizeDecision,
  organizeDecisionKey,
  organizeDecisionSignature,
  operationPreviewForFile,
  type OrganizeDecision,
  type OrganizeDecisionRecord,
  validateOrganizeFileName
} from "../views/organize/organizeModel";

interface OrganizeDecisionStore {
  decisions: Record<string, OrganizeDecisionRecord>;
  syncSuggestions: (scope: LibraryScope, files: readonly FileRecord[], previews: readonly OperationPreview[]) => void;
  setDecision: (
    scope: LibraryScope,
    file: FileRecord,
    preview: OperationPreview | null,
    state: OrganizeDecision,
    editedName?: string
  ) => boolean;
  clearDecision: (scope: LibraryScope, file: FileRecord, preview: OperationPreview | null) => void;
  setEditedNameForPreview: (scopeKey: string, preview: OperationPreview, name: string) => boolean;
}

export const useOrganizeDecisionStore = create<OrganizeDecisionStore>((set, get) => ({
  decisions: {},
  syncSuggestions: (scope, files, previews) => {
    set((current) => {
      const decisions = { ...current.decisions };
      for (const file of files) {
        const preview = operationPreviewForFile(previews, file.id);
        const key = organizeDecisionKey(scope, file.id);
        const signature = organizeDecisionSignature(file, preview);
        const existing = decisions[key];
        if (!existing || existing.signature !== signature) {
          decisions[key] = {
            fileId: file.id,
            scopeKey: key.slice(0, key.lastIndexOf("::")),
            signature,
            state: initialOrganizeDecision(file, preview)
          };
        }
      }
      return { decisions };
    });
  },
  setDecision: (scope, file, preview, state, editedName) => {
    const suggestions = buildOrganizeSuggestions([file], preview ? [preview] : [], scope, get().decisions);
    const suggestion = suggestions[0];
    if (!suggestion || !canSetOrganizeDecision(suggestion, state, editedName)) return false;
    const key = organizeDecisionKey(scope, file.id);
    set((current) => ({
      decisions: {
        ...current.decisions,
        [key]: {
          fileId: file.id,
          scopeKey: key.slice(0, key.lastIndexOf("::")),
          signature: organizeDecisionSignature(file, preview),
          state,
          ...(state === "edited" && editedName ? { editedName: editedName.trim() } : {})
        }
      }
    }));
    return true;
  },
  clearDecision: (scope, file, preview) => {
    const key = organizeDecisionKey(scope, file.id);
    set((current) => ({
      decisions: {
        ...current.decisions,
        [key]: {
          fileId: file.id,
          scopeKey: key.slice(0, key.lastIndexOf("::")),
          signature: organizeDecisionSignature(file, preview),
          state: initialOrganizeDecision(file, preview)
        }
      }
    }));
  },
  setEditedNameForPreview: (scopeKey, preview, name) => {
    const editedName = name.trim();
    if (validateOrganizeFileName(name) !== null) return false;
    const key = `${scopeKey}::${preview.fileId || preview.file_id}`;
    const existing = get().decisions[key];
    if (!existing) return false;
    if (existing.state === "edited" && existing.editedName === editedName) return true;
    set((current) => ({ decisions: { ...current.decisions, [key]: { ...existing, state: "edited", editedName } } }));
    return true;
  }
}));
