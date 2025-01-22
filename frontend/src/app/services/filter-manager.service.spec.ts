import { TestBed } from '@angular/core/testing';

import { FilterManagerService } from './filter-manager.service';

describe('FilterManagerService', () => {
  let service: FilterManagerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FilterManagerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
