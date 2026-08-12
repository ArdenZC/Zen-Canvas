import { invokeCommand, listenTo, type EventHandler } from "./core";
import type { FileRecord } from "../types/domain";

export const runtimeApi = {
  insertFile(file: Pick<FileRecord, "id" | "path" | "name" | "extension" | "size"> & { mtime: number; isDir: boolean; stateCode: number }): Promise<void> {
    return invokeCommand<void>("insert_file", { file });
  },
  removeFilesByPaths(paths: string[]): Promise<number> {
    return invokeCommand<number>("remove_files_by_paths", { paths });
  },
  markFilesStaleByPaths(paths: string[]): Promise<number> {
    return invokeCommand<number>("remove_files_by_paths", { paths });
  },
  upsertFilesByPaths(paths: string[]): Promise<number> {
    return invokeCommand<number>("upsert_files_by_paths", { paths });
  }
};

export type RuntimeApi = typeof runtimeApi;
