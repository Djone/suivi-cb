import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';


// Importation des données de locale pour le français
//import { LOCALE_ID } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';

// Chart.js - Enregistrer les composants nécessaires
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

// Enregistrer les données de locale
registerLocaleData(localeFr);

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));

