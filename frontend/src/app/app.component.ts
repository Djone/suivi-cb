import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { ToastModule } from 'primeng/toast';
import { environment } from '../environments/environment'; // Importer l'environnement

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule, ToastModule],
  template: '<router-outlet></router-outlet><p-toast></p-toast>',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit {
  // Variable pour déterminer l'environnement
  public isProduction = environment.production;

  constructor(private titleService: Title) {}

  ngOnInit(): void {
    this.setAppTitle();
  }

  private setAppTitle(): void {
    const baseTitle = 'Suivi Bancaire';
    // Ajouter un suffixe si on n'est pas en production
    const newTitle = this.isProduction ? baseTitle : `${baseTitle} (Dev)`;
    this.titleService.setTitle(newTitle);
  }
}
