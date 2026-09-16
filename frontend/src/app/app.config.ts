import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';

// PrimeNG (https://www.primefaces.org/primeng/) Interfaces utilisateur
import { DialogService } from 'primeng/dynamicdialog';

import { LOCALE_ID } from '@angular/core';
import { providePrimeNG } from 'primeng/config';
import { MessageService } from 'primeng/api';
import aura from '@primeng/themes/aura';

import { APP_VERSION, APP_BUILD_TIME, APP_ENV } from './version';

export const APP_INFO = {
  version: APP_VERSION,
  buildTime: APP_BUILD_TIME,
  env: APP_ENV,
};

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
      translation: {
        firstDayOfWeek: 1,
        dayNames: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'],
        dayNamesShort: ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'],
        dayNamesMin: ['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa'],
        monthNames: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
        monthNamesShort: ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'],
        today: "Aujourd'hui",
        clear: 'Réinitialiser',
      },
      theme: {
        preset: aura,
        options: {
          darkModeSelector: false,
        },
      },
    }),
    DialogService,
    MessageService,
  ],
};
