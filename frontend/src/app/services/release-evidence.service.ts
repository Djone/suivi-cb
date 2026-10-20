import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
export interface EvidenceManifest {
  candidate: string;
  commit: string;
  archiveSha256: string;
  exceptionReviewBy: string;
  images: Record<string, { configDigest: string; registryRef?: string }>;
}
export interface EvidenceCheck {
  id: string;
  label: string;
  status: string;
  stage: string;
}
export interface EvidenceReport {
  reservations?: Array<{
    component: string;
    reviewBy?: string | null;
    owner?: string;
    justification?: string;
    targetVersion?: string;
    status?: string;
  }>;
  dossier: null | {
    identity: string;
    revision: number;
    manifest: EvidenceManifest;
    scope: { frozen: boolean; summary: string; releaseNotes: string };
    origin: {
      kind: string;
      githubUrl: string | null;
      authenticatedGithubProvenance: boolean;
    };
    validations: Record<
      string,
      {
        approved: boolean;
        by: string;
        at: string;
        reference: string;
        kind: string;
      }
    >;
    importedAt: string;
  };
  checks: EvidenceCheck[];
  blockers: Array<{ id: string; label: string; stage: string }>;
  readyForPreproduction: boolean;
  readyForProduction: boolean;
  canClose: boolean;
  publicationEnabled: boolean;
  repository: { commit: string | null; clean: boolean };
}
@Injectable({ providedIn: 'root' })
export class ReleaseEvidenceService {
  private readonly url = environment.apiUrl + '/api/release/evidence';
  constructor(private readonly http: HttpClient) {}
  read() {
    return this.http.get<EvidenceReport>(this.url);
  }
  importBundle(source: string, runId: string) {
    return this.http.post<EvidenceReport>(this.url + '/import', {
      source,
      runId,
    });
  }
  update(payload: Record<string, unknown>) {
    return this.http.post<EvidenceReport>(this.url, payload);
  }
  report() {
    return this.http.post<EvidenceReport>(this.url + '/report', {});
  }
}
