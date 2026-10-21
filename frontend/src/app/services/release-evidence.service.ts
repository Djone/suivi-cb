import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
export interface DsmRequestState {
  request: {
    nonce: string;
    action: 'plan' | 'apply-preproduction';
    candidate: string;
    identity: string;
  };
  status: string;
  pending?: boolean;
  receipt?: { nonce: string; status: string };
}
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
    releasePlan?: {
      stableVersion: string;
      nextDevVersion: string;
      status: string;
      identity: string;
    } | null;
    executions?: Array<{
      nonce: string;
      action: string;
      status: string;
      recordedAt: string;
    }>;
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
export interface CandidateFlowStatus {
  publication?: { candidate: string; status: string; url: string } | null;
  branch: string | null;
  commit: string | null;
  clean: boolean;
  pushed: boolean;
  protected: boolean;
  ready: boolean;
  run: {
    id: string;
    status: string;
    conclusion: string | null;
    url: string;
  } | null;
  blockers: string[];
  task: {
    id: string;
    status: string;
    candidate: string | null;
    runId: string;
    error: string | null;
  } | null;
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
  candidateStatus() {
    return this.http.get<CandidateFlowStatus>(this.url + '/candidate');
  }
  prepareCandidate(commit: string) {
    return this.http.post<CandidateFlowStatus>(this.url + '/candidate', {
      commit,
    });
  }
  publishCandidate(commit: string) {
    return this.http.post<{ candidate: string; status: string; url: string }>(
      this.url + '/candidate/publish',
      { commit, confirm: true },
    );
  }
  candidateArchive() {
    return this.http.get(this.url + '/candidate/archive', {
      responseType: 'blob',
    });
  }
  nasKit(identity: string, revision: number) {
    return this.http.post(
      this.url + '/candidate/nas-kit',
      { identity, revision, confirmPreproduction: true },
      { responseType: 'blob' },
    );
  }
  createSshKey() {
    return this.http.post<{ configured: boolean; publicKey: string }>(
      this.url + '/nas/ssh/key',
      { confirm: true },
    );
  }
  probeSsh() {
    return this.http.post<{ connected: boolean; dsmInstalled?: boolean }>(
      this.url + '/nas/ssh/probe',
      {},
    );
  }
  sshPlan(identity: string, revision: number) {
    return this.http.post<{ candidate: string; planOnly: boolean }>(
      this.url + '/nas/ssh/plan',
      { identity, revision },
    );
  }
  sshInstaller() {
    return this.http.get(this.url + '/nas/ssh/installer', {
      responseType: 'blob',
    });
  }
  dsmKit() {
    return this.http.get(this.url + '/nas/dsm-kit', { responseType: 'blob' });
  }
  dsmStatus() {
    return this.http.get<{ lastRequest: DsmRequestState | null }>(
      this.url + '/nas/dsm',
    );
  }
  dsmQueue(
    identity: string,
    revision: number,
    action: 'plan' | 'apply-preproduction',
    confirm = false,
  ) {
    return this.http.post<DsmRequestState>(this.url + '/nas/dsm/requests', {
      identity,
      revision,
      action,
      confirm,
    });
  }
  dsmReceipt(nonce: string) {
    return this.http.get<DsmRequestState>(
      this.url + '/nas/dsm/receipts/' + encodeURIComponent(nonce),
    );
  }
  report() {
    return this.http.post<EvidenceReport>(this.url + '/report', {});
  }
}
