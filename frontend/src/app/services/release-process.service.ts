import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type ReleaseCommand = 'dry-run' | 'prepare' | 'deploy' | 'full' | 'rollback';

export interface ReleaseRunRequest {
  command: ReleaseCommand;
  stable?: string;
  next?: string;
  branch?: string;
  allowDirty?: boolean;
  skipMasterCheck?: boolean;
  skipTests?: boolean;
  skipBuild?: boolean;
  execute?: boolean;
  withNasDeploy?: boolean;
  report?: string;
  createReleaseBranch?: boolean;
  releaseBranch?: string;
  branchPrefix?: string;
  commit?: boolean;
  tag?: boolean;
  rollbackOnFailure?: boolean;
  backupFile?: string;
}

export interface ReleaseLogLine {
  at: string;
  source: 'stdout' | 'stderr';
  line: string;
}

export interface ReleaseRun {
  id: string;
  command: ReleaseCommand;
  startedAt: string;
  endedAt: string | null;
  status: 'running' | 'passed' | 'failed';
  exitCode: number | null;
  options: Record<string, unknown>;
  logs: ReleaseLogLine[];
}

export interface ReleaseStatusResponse {
  running: boolean;
  activeRun: ReleaseRun | null;
  lastRun: ReleaseRun | null;
  lastReport: unknown;
}

export interface ReleaseRunResponse {
  message: string;
  run: ReleaseRun;
}

@Injectable({
  providedIn: 'root',
})
export class ReleaseProcessService {
  private readonly apiUrl = `${environment.apiUrl}/api/release`;

  constructor(private readonly http: HttpClient) {}

  run(request: ReleaseRunRequest): Observable<ReleaseRunResponse> {
    return this.http.post<ReleaseRunResponse>(`${this.apiUrl}/run`, request);
  }

  getStatus(): Observable<ReleaseStatusResponse> {
    return this.http.get<ReleaseStatusResponse>(`${this.apiUrl}/status`);
  }
}
