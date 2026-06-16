import path from "node:path";
import type { FileRecord, OperationPreview } from "../types/domain.js";
import { randomId } from "./id.js";

export function createOperationPreviews(files: FileRecord[]): OperationPreview[] {
  return files
    .filter((file) =>
      ["Move", "Rename", "MoveAndRename", "Archive"].includes(file.suggested_action)
    )
    .map((file) => {
      const targetDirectory =
        file.suggested_target_path || (file.suggested_action === "Rename" ? file.directory : "");
      const newName = file.suggested_name || file.name;
      const targetPath = targetDirectory ? path.join(targetDirectory, newName) : file.path;
      const isMove = targetDirectory && path.resolve(targetDirectory) !== path.resolve(file.directory);
      const isRename = newName !== file.name;
      const operationType: OperationPreview["operation_type"] =
        isMove && isRename ? "move_rename" : isMove ? "move" : "rename";
      const isSensitive = file.risk_level === "Sensitive";
      const isLowConfidence = file.confidence < 0.7;
      const requiresConfirmation = file.requires_confirmation || isLowConfidence;
      return {
        id: randomId("op"),
        fileId: file.id,
        operation_type: operationType,
        source_path: file.path,
        target_path: targetPath,
        old_name: file.name,
        new_name: newName,
        status: "pending" as const,
        risk_level: file.risk_level,
        confidence: file.confidence,
        requires_confirmation: requiresConfirmation,
        reason: file.classification_reason,
        selected_by_default: !isSensitive && !requiresConfirmation,
        is_executable: !isSensitive,
        blocking_reason: isSensitive ? "Sensitive files are advice-only in this version" : undefined,
        editable_new_name: true
      };
    })
    .filter((operation) => operation.source_path !== operation.target_path);
}
