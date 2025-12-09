import { Component, OnInit, OnDestroy, ViewChild, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { TransactionService } from '../../services/transaction.service';
import { SubCategoryService } from '../../services/sub-category.service';
import { AccountService } from '../../services/account.service';
import { Transaction } from '../../models/transaction.model';
import { SubCategory } from '../../models/sub-category.model';
import { Account } from '../../models/account.model';
import { Subscription } from 'rxjs';

// PrimeNG
import { CardModule } from 'primeng/card';
import { DropdownModule } from 'primeng/dropdown';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TabViewModule } from 'primeng/tabview';

interface CategoryStat {
  categoryLabel: string;
  total: number;
  color: string;
}

interface MonthlyEvolution {
  month: string;
  expenses: number;
  income: number;
  balance: number;
}

interface YearlyAverage {
  categoryLabel: string;
  average: number;
}

interface MonthlyCategoryRow {
  label: string;
  monthlyTotals: number[];
  total: number;
  average: number;
  subCategories: MonthlyCategoryRow[];
}

@Component({
  selector: 'app-statistics',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    BaseChartDirective,
    CardModule,
    DropdownModule,
    ButtonModule,
    TableModule,
    TabViewModule
  ],
  templateUrl: './statistics.component.html',
  styleUrls: ['./statistics.component.css']
})
export class StatisticsComponent implements OnInit, OnDestroy {
  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;

  transactions: Transaction[] = [];
  subCategories: SubCategory[] = [];
  accounts: Account[] = [];
  private subscriptions = new Subscription();

  // Filtres
  selectedAccount: number | null = null;
  selectedYear: number = new Date().getFullYear();
  selectedMonth: number | null = null;
  availableYears: number[] = [];

  // Options pour les dropdowns
  accountOptions: any[] = [];
  yearOptions: any[] = [];
  availableMonths = [
    { label: 'Tous les mois', value: null },
    { label: 'Janvier', value: 0 },
    { label: 'Février', value: 1 },
    { label: 'Mars', value: 2 },
    { label: 'Avril', value: 3 },
    { label: 'Mai', value: 4 },
    { label: 'Juin', value: 5 },
    { label: 'Juillet', value: 6 },
    { label: 'Août', value: 7 },
    { label: 'Septembre', value: 8 },
    { label: 'Octobre', value: 9 },
    { label: 'Novembre', value: 10 },
    { label: 'Décembre', value: 11 }
  ];

  // Données des graphiques
  expensesByCategory: CategoryStat[] = [];
  incomesByCategory: CategoryStat[] = [];
  monthlyEvolution: MonthlyEvolution[] = [];
  yearlyExpensesAverage: YearlyAverage[] = [];
  yearlyIncomesAverage: YearlyAverage[] = [];
  expensesMonthlyTable: MonthlyCategoryRow[] = [];
  incomesMonthlyTable: MonthlyCategoryRow[] = [];
  expenseExpanded: { [key: string]: boolean } = {};
  incomeExpanded: { [key: string]: boolean } = {};
  monthColumns = [
    { label: 'Janv.', index: 0 },
    { label: 'Févr.', index: 1 },
    { label: 'Mars', index: 2 },
    { label: 'Avr.', index: 3 },
    { label: 'Mai', index: 4 },
    { label: 'Juin', index: 5 },
    { label: 'Juil.', index: 6 },
    { label: 'Août', index: 7 },
    { label: 'Sept.', index: 8 },
    { label: 'Oct.', index: 9 },
    { label: 'Nov.', index: 10 },
    { label: 'Déc.', index: 11 },
  ];

  // Configuration Chart.js pour dépenses par catégorie
  public pieChartExpensesData: ChartData<'pie'> = {
    labels: [],
    datasets: [{
      data: [],
      backgroundColor: []
    }]
  };
  public pieChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    plugins: {
      legend: {
        position: 'right',
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            let label = context.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed !== null) {
              label += new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(context.parsed);
            }
            return label;
          }
        }
      }
    }
  };
  public pieChartType: ChartType = 'pie';

  // Configuration Chart.js pour revenus par catégorie
  public pieChartIncomesData: ChartData<'pie'> = {
    labels: [],
    datasets: [{
      data: [],
      backgroundColor: []
    }]
  };

  // Configuration Chart.js pour évolution mensuelle
  public lineChartData: ChartData<'line'> = {
    labels: [],
    datasets: [
      {
        data: [],
        label: 'Dépenses',
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: true,
        tension: 0.4
      },
      {
        data: [],
        label: 'Revenus',
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.4
      },
      {
        data: [],
        label: 'Solde',
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4
      }
    ]
  };
  public lineChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(context.parsed.y);
            }
            return label;
          }
        }
      }
    }
  };
  public lineChartType: ChartType = 'line';

  public isBrowser: boolean;

  constructor(
    private transactionService: TransactionService,
    private subCategoryService: SubCategoryService,
    private accountService: AccountService,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    // Charger les comptes
    this.subscriptions.add(
      this.accountService.accounts$.subscribe({
        next: (accounts) => {
          this.accounts = accounts;
          this.updateAccountOptions();
        }
      })
    );
    this.accountService.getAccounts().subscribe();

    // Charger les sous-catégories
    this.subscriptions.add(
      this.subCategoryService.subCategories$.subscribe({
        next: (subCats) => {
          this.subCategories = subCats;
          this.calculateStatistics();
        }
      })
    );
    this.subCategoryService.getSubCategories().subscribe();

    // Charger les transactions
    this.subscriptions.add(
      this.transactionService.transactions$.subscribe({
        next: (transactions) => {
          this.transactions = transactions;
          this.extractAvailableYears();
          this.calculateStatistics();
        }
      })
    );
    this.transactionService.getTransactions().subscribe();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  extractAvailableYears(): void {
    const years = new Set<number>();
    this.transactions.forEach(t => {
      if (t.date) {
        const year = new Date(t.date).getFullYear();
        years.add(year);
      }
    });
    this.availableYears = Array.from(years).sort((a, b) => b - a);
    this.updateYearOptions();
  }

  updateAccountOptions(): void {
    this.accountOptions = [
      { label: 'Tous les comptes', value: null },
      ...this.accounts.map(a => ({ label: a['name'], value: a.id }))
    ];
  }

  updateYearOptions(): void {
    this.yearOptions = this.availableYears.map(y => ({ label: y.toString(), value: y }));
  }

  applyFilters(): void {
    this.calculateStatistics();
  }

  getFilteredTransactions(): Transaction[] {
    return this.transactions.filter(t => {
      // Filtre par compte
      if (this.selectedAccount !== null) {
        const tAccountId = typeof t.accountId === 'string' ? parseInt(t.accountId) : t.accountId;
        if (tAccountId !== this.selectedAccount) return false;
      }

      // Filtre par année
      if (t.date) {
        const tDate = new Date(t.date);
        const tYear = tDate.getFullYear();
        if (tYear !== this.selectedYear) return false;

        // Filtre par mois
        if (this.selectedMonth !== null) {
          const tMonth = tDate.getMonth();
          if (tMonth !== this.selectedMonth) return false;
        }
      }

      return true;
    });
  }

  calculateStatistics(): void {
    const filteredTransactions = this.getFilteredTransactions();

    this.calculateExpensesByCategory(filteredTransactions);
    this.calculateIncomesByCategory(filteredTransactions);
    this.calculateMonthlyEvolution();
    this.calculateYearlyAverages();
    this.calculateMonthlyCategoryTables();
  }

  calculateExpensesByCategory(transactions: Transaction[]): void {
    const categoryMap = new Map<string, number>();

    transactions.forEach(t => {
      const flowId = typeof t.financialFlowId === 'string' ? parseInt(t.financialFlowId) : t.financialFlowId;
      if (flowId !== 2) return; // Seulement les dépenses

      const subCatId = typeof t.subCategoryId === 'string' ? parseInt(t.subCategoryId) : t.subCategoryId;
      const subCategory = this.subCategories.find(sc => sc.id === subCatId);
      const categoryLabel = subCategory?.categoryLabel || 'Non catégorisé';

      const amount = typeof t.amount === 'string' ? parseFloat(t.amount) : (t.amount || 0);
      categoryMap.set(categoryLabel, (categoryMap.get(categoryLabel) || 0) + Math.abs(amount));
    });

    this.expensesByCategory = Array.from(categoryMap.entries())
      .map(([categoryLabel, total]) => ({
        categoryLabel,
        total,
        color: this.getCategoryColor(categoryLabel)
      }))
      .sort((a, b) => b.total - a.total);

    // Mettre à jour le graphique en camembert
    if (this.isBrowser) {
      this.pieChartExpensesData = {
        labels: this.expensesByCategory.map(c => c.categoryLabel),
        datasets: [{
          data: this.expensesByCategory.map(c => c.total),
          backgroundColor: this.expensesByCategory.map(c => c.color)
        }]
      };
      this.chart?.update();
    }
  }

  calculateIncomesByCategory(transactions: Transaction[]): void {
    const categoryMap = new Map<string, number>();

    transactions.forEach(t => {
      const flowId = typeof t.financialFlowId === 'string' ? parseInt(t.financialFlowId) : t.financialFlowId;
      if (flowId !== 1) return; // Seulement les revenus

      const subCatId = typeof t.subCategoryId === 'string' ? parseInt(t.subCategoryId) : t.subCategoryId;
      const subCategory = this.subCategories.find(sc => sc.id === subCatId);
      const categoryLabel = subCategory?.categoryLabel || 'Non catégorisé';

      const amount = typeof t.amount === 'string' ? parseFloat(t.amount) : (t.amount || 0);
      categoryMap.set(categoryLabel, (categoryMap.get(categoryLabel) || 0) + Math.abs(amount));
    });

    this.incomesByCategory = Array.from(categoryMap.entries())
      .map(([categoryLabel, total]) => ({
        categoryLabel,
        total,
        color: this.getCategoryColor(categoryLabel)
      }))
      .sort((a, b) => b.total - a.total);

    // Mettre à jour le graphique en camembert
    if (this.isBrowser) {
      this.pieChartIncomesData = {
        labels: this.incomesByCategory.map(c => c.categoryLabel),
        datasets: [{
          data: this.incomesByCategory.map(c => c.total),
          backgroundColor: this.incomesByCategory.map(c => c.color)
        }]
      };
    }
  }

  calculateMonthlyEvolution(): void {
    const monthlyData = new Map<number, { expenses: number, income: number }>();

    // Filtrer par année et compte seulement
    const yearTransactions = this.transactions.filter(t => {
      if (this.selectedAccount !== null) {
        const tAccountId = typeof t.accountId === 'string' ? parseInt(t.accountId) : t.accountId;
        if (tAccountId !== this.selectedAccount) return false;
      }
      if (t.date) {
        const tYear = new Date(t.date).getFullYear();
        return tYear === this.selectedYear;
      }
      return false;
    });

    // Initialiser tous les mois
    for (let month = 0; month < 12; month++) {
      monthlyData.set(month, { expenses: 0, income: 0 });
    }

    // Calculer les totaux par mois
    yearTransactions.forEach(t => {
      const tDate = new Date(t.date!);
      const month = tDate.getMonth();
      const flowId = typeof t.financialFlowId === 'string' ? parseInt(t.financialFlowId) : t.financialFlowId;
      const amount = typeof t.amount === 'string' ? parseFloat(t.amount) : (t.amount || 0);

      const data = monthlyData.get(month)!;
      if (flowId === 2) {
        data.expenses += Math.abs(amount);
      } else if (flowId === 1) {
        data.income += Math.abs(amount);
      }
    });

    // Calculer le solde initial pour l'année sélectionnée
    let initialBalance = 0;

    if (this.selectedAccount !== null) {
      // Si un compte spécifique est sélectionné, utiliser son initialBalance
      const account = this.accounts.find(a => a.id === this.selectedAccount);
      if (account) {
        initialBalance = typeof account['initialBalance'] === 'string'
          ? parseFloat(account['initialBalance'])
          : (account['initialBalance'] || 0);
      }
    } else {
      // Si "Tous les comptes", additionner les initialBalance de tous les comptes
      initialBalance = this.accounts.reduce((sum, account) => {
        const balance = typeof account['initialBalance'] === 'string'
          ? parseFloat(account['initialBalance'])
          : (account['initialBalance'] || 0);
        return sum + balance;
      }, 0);
    }

    // Ajouter les transactions avant l'année sélectionnée
    const transactionsBeforeYear = this.transactions.filter(t => {
      if (this.selectedAccount !== null) {
        const tAccountId = typeof t.accountId === 'string' ? parseInt(t.accountId) : t.accountId;
        if (tAccountId !== this.selectedAccount) return false;
      }
      if (t.date) {
        const tYear = new Date(t.date).getFullYear();
        return tYear < this.selectedYear;
      }
      return false;
    });

    transactionsBeforeYear.forEach(t => {
      const flowId = typeof t.financialFlowId === 'string' ? parseInt(t.financialFlowId) : t.financialFlowId;
      const amount = typeof t.amount === 'string' ? parseFloat(t.amount) : (t.amount || 0);

      if (flowId === 2) {
        initialBalance -= Math.abs(amount);
      } else if (flowId === 1) {
        initialBalance += Math.abs(amount);
      }
    });

    // Convertir en tableau avec solde cumulatif
    this.monthlyEvolution = [];
    const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    let cumulativeBalance = initialBalance;

    for (let month = 0; month < 12; month++) {
      const data = monthlyData.get(month)!;
      cumulativeBalance += (data.income - data.expenses);

      this.monthlyEvolution.push({
        month: monthNames[month],
        expenses: data.expenses,
        income: data.income,
        balance: cumulativeBalance
      });
    }

    // Mettre à jour le graphique linéaire
    if (this.isBrowser) {
      this.lineChartData = {
        labels: this.monthlyEvolution.map(m => m.month),
        datasets: [
          {
            data: this.monthlyEvolution.map(m => m.expenses),
            label: 'Dépenses',
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            fill: true,
            tension: 0.4
          },
          {
            data: this.monthlyEvolution.map(m => m.income),
            label: 'Revenus',
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            fill: true,
            tension: 0.4
          },
          {
            data: this.monthlyEvolution.map(m => m.balance),
            label: 'Solde',
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: true,
            tension: 0.4
          }
        ]
      };
    }
  }

  calculateYearlyAverages(): void {
    // Calculer la moyenne annuelle par catégorie
    const expensesCategoryMap = new Map<string, number[]>();
    const incomesCategoryMap = new Map<string, number[]>();

    // Filtrer par compte si sélectionné
    const accountTransactions = this.selectedAccount !== null
      ? this.transactions.filter(t => {
          const tAccountId = typeof t.accountId === 'string' ? parseInt(t.accountId) : t.accountId;
          return tAccountId === this.selectedAccount;
        })
      : this.transactions;

    // Grouper par année et catégorie
    accountTransactions.forEach(t => {
      if (!t.date) return;

      const tYear = new Date(t.date).getFullYear();
      if (tYear !== this.selectedYear) return;

      const flowId = typeof t.financialFlowId === 'string' ? parseInt(t.financialFlowId) : t.financialFlowId;
      const subCatId = typeof t.subCategoryId === 'string' ? parseInt(t.subCategoryId) : t.subCategoryId;
      const subCategory = this.subCategories.find(sc => sc.id === subCatId);
      const categoryLabel = subCategory?.categoryLabel || 'Non catégorisé';
      const amount = typeof t.amount === 'string' ? parseFloat(t.amount) : (t.amount || 0);

      if (flowId === 2) {
        if (!expensesCategoryMap.has(categoryLabel)) {
          expensesCategoryMap.set(categoryLabel, []);
        }
        expensesCategoryMap.get(categoryLabel)!.push(Math.abs(amount));
      } else if (flowId === 1) {
        if (!incomesCategoryMap.has(categoryLabel)) {
          incomesCategoryMap.set(categoryLabel, []);
        }
        incomesCategoryMap.get(categoryLabel)!.push(Math.abs(amount));
      }
    });

    // Calculer les moyennes
    this.yearlyExpensesAverage = Array.from(expensesCategoryMap.entries())
      .map(([categoryLabel, amounts]) => ({
        categoryLabel,
        average: amounts.reduce((sum, a) => sum + a, 0) / 12 // Moyenne sur 12 mois
      }))
      .sort((a, b) => b.average - a.average);

    this.yearlyIncomesAverage = Array.from(incomesCategoryMap.entries())
      .map(([categoryLabel, amounts]) => ({
        categoryLabel,
        average: amounts.reduce((sum, a) => sum + a, 0) / 12 // Moyenne sur 12 mois
      }))
      .sort((a, b) => b.average - a.average);
  }

  getCategoryColor(categoryLabel: string): string {
    const colors: { [key: string]: string } = {
      'Salaires': '#10b981',
      'Habitation': '#3b82f6',
      'Quotidien': '#f59e0b',
      'Transports': '#ef4444',
      'Divertissements': '#8b5cf6',
      'Dettes': '#dc2626',
      'Santé': '#06b6d4',
      'Éducation': '#84cc16',
      'Épargne': '#059669',
      'Autres': '#6b7280'
    };
    return colors[categoryLabel] || this.getRandomColor();
  }

  getRandomColor(): string {
    const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  getTotalExpenses(): number {
    return this.expensesByCategory.reduce((sum, c) => sum + c.total, 0);
  }

  getTotalIncomes(): number {
    return this.incomesByCategory.reduce((sum, c) => sum + c.total, 0);
  }

  calculateMonthlyCategoryTables(): void {
    const transactionsForYear = this.transactions.filter(t => {
      if (!t.date) return false;
      const tYear = new Date(t.date).getFullYear();
      if (tYear !== this.selectedYear) return false;

      if (this.selectedAccount !== null) {
        const tAccountId = typeof t.accountId === 'string' ? parseInt(t.accountId) : t.accountId;
        if (tAccountId !== this.selectedAccount) return false;
      }
      return true;
    });

    this.expensesMonthlyTable = this.buildMonthlyCategoryRows(transactionsForYear, 2);
    this.incomesMonthlyTable = this.buildMonthlyCategoryRows(transactionsForYear, 1);
    this.expenseExpanded = {};
    this.incomeExpanded = {};
  }

  private buildMonthlyCategoryRows(transactions: Transaction[], flowId: number): MonthlyCategoryRow[] {
    const categoryMap = new Map<string, { monthlyTotals: number[]; subMap: Map<string, number[]> }>();

    transactions.forEach(t => {
      if (!t.date) return;
      const parsedFlowId = typeof t.financialFlowId === 'string' ? parseInt(t.financialFlowId) : t.financialFlowId;
      if (parsedFlowId !== flowId) return;

      const transactionDate = new Date(t.date);
      const month = transactionDate.getMonth();
      const amount = Math.abs(typeof t.amount === 'string' ? parseFloat(t.amount) : (t.amount || 0));

      const subCatId = typeof t.subCategoryId === 'string' ? parseInt(t.subCategoryId) : t.subCategoryId;
      const subCategory = this.subCategories.find(sc => sc.id === subCatId);
      const categoryLabel = subCategory?.categoryLabel || 'Non catégorisé';
      const subLabel = subCategory?.label || 'Sans sous-catégorie';

      if (!categoryMap.has(categoryLabel)) {
        categoryMap.set(categoryLabel, { monthlyTotals: Array(12).fill(0), subMap: new Map<string, number[]>() });
      }

      const categoryData = categoryMap.get(categoryLabel)!;
      categoryData.monthlyTotals[month] += amount;

      if (!categoryData.subMap.has(subLabel)) {
        categoryData.subMap.set(subLabel, Array(12).fill(0));
      }
      const subTotals = categoryData.subMap.get(subLabel)!;
      subTotals[month] += amount;
      categoryData.subMap.set(subLabel, subTotals);
    });

    return Array.from(categoryMap.entries())
      .map(([label, data]) => {
        const total = data.monthlyTotals.reduce((sum, value) => sum + value, 0);
        const subCategories = Array.from(data.subMap.entries())
          .map(([subLabel, monthlyTotals]) => {
            const subTotal = monthlyTotals.reduce((sum, value) => sum + value, 0);
            return {
              label: subLabel,
              monthlyTotals,
              total: subTotal,
              average: subTotal / 12,
              subCategories: []
            };
          })
          .sort((a, b) => b.total - a.total);

        return {
          label,
          monthlyTotals: data.monthlyTotals,
          total,
          average: total / 12,
          subCategories
        };
      })
      .sort((a, b) => b.total - a.total);
  }

  toggleExpenseRow(label: string): void {
    this.expenseExpanded = { ...this.expenseExpanded, [label]: !this.expenseExpanded[label] };
  }

  toggleIncomeRow(label: string): void {
    this.incomeExpanded = { ...this.incomeExpanded, [label]: !this.incomeExpanded[label] };
  }
}
