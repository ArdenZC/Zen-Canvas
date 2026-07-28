import type { GlobalSearchRequest, GlobalSearchResponse } from "../../types/domain";

export class SpotlightQueryController {
  private session = 0;
  private sequence = 0;
  private latestRequestId: string | null = null;
  private sourceRevision: string | null = null;

  openSession(session?: number) {
    this.session = session ?? this.session + 1;
    this.sequence = 0;
    this.latestRequestId = null;
    this.sourceRevision = null;
  }

  closeSession() {
    this.session += 1;
    this.latestRequestId = null;
    this.sourceRevision = null;
  }

  nextRequest(query: string, limit: number): GlobalSearchRequest {
    this.sequence += 1;
    const requestId = `spotlight:${this.session}:${this.sequence}`;
    this.latestRequestId = requestId;
    return { version: 2, requestId, query, limit, offset: 0, cursor: null };
  }

  accepts(response: Pick<GlobalSearchResponse, "requestId">) {
    return response.requestId === this.latestRequestId;
  }

  acceptSourceRevision(sourceRevision: string) {
    const changed = this.sourceRevision !== null && this.sourceRevision !== sourceRevision;
    this.sourceRevision = sourceRevision;
    return changed;
  }
}
