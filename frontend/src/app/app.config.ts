import { ApplicationConfig, provideZoneChangeDetection, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';

// PrimeNG (https://www.primefaces.org/primeng/) Interfaces utilisateur
import { DialogService, DynamicDialogModule } from 'primeng/dynamicdialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { CardModule } from 'primeng/card';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { ToastModule } from 'primeng/toast';

import { LOCALE_ID } from '@angular/core';
import { providePrimeNG } from 'primeng/config';
import { MessageService } from 'primeng/api';
import aura from '@primeng/themes/aura';

// Enregistrer les données de locale pour le français
registerLocaleData(localeFr);

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideAnimationsAsync(),
    provideHttpClient(withFetch()),    
    { provide: LOCALE_ID, useValue: 'fr' },    
    providePrimeNG({
      theme: {
        preset: aura,
        options: {
          darkModeSelector: false
        }
      }
    }),
    DialogService,
    MessageService
  ]
};
