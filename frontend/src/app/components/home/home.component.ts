import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart } from 'chart.js/auto';

@Component({
  selector: 'app-home',
  standalone: true,
  imports : [ CommonModule ],
  templateUrl: './home.component.html',
  styleUrls: [ './home.component.css' ]
})
export class HomeComponent implements OnInit {
  lastTransactions = [
    { date: '2025-01-01', label: 'Achat Supermarché', amount: -50.75 },
    { date: '2025-01-01', label: 'Salaire', amount: 2500.00 },
    { date: '2024-12-30', label: 'Électricité', amount: -120.00 },
    // Ajoutez d'autres transactions fictives
  ];

  accountBalance = 1500.75; // En dur pour le moment
  forecastEndOfMonth = 1400.50; // Prévisionnel du compte
  chartData = [50, 100, 150, 200]; // Données fictives pour le graphique

  constructor() {}

  ngOnInit(): void {}

}
