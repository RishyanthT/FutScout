import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { FutscoutApiService, CompareResponse, PlayerListItem } from '../../services/futscout-api.service';
import { RadarChartComponent } from '../../components/radar-chart/radar-chart.component';
import { PitchHeatmapComponent } from '../../components/pitch-heatmap/pitch-heatmap.component';

@Component({
  selector: 'app-futscout',
  standalone: true,
  imports: [CommonModule, FormsModule, RadarChartComponent, PitchHeatmapComponent],
  templateUrl: './futscout.component.html',
  styleUrl: './futscout.component.scss',
})
export class FutscoutComponent implements OnInit {
  leagues: string[] = [];
  positions: string[] = ['ALL'];

  league = '';
  pos = 'ALL';
  min90s = 5;

  players: PlayerListItem[] = [];
  playerA = '';
  playerB = '';

  loading = false;
  error: string | null = null;

  compareResult: CompareResponse | null = null;

  // Shared max intensity across both heatmaps (so both are comparable visually)
  private maxHeat = 1;

  constructor(private api: FutscoutApiService) {}

  ngOnInit(): void {
    this.api.getLeagues().subscribe((r) => {
      this.leagues = r.leagues;
      this.league = this.leagues[0] ?? '';
      this.loadPlayers();
    });

    this.api.getPositions().subscribe((r) => {
      this.positions = ['ALL', ...r.positions];
    });
  }

  loadPlayers(): void {
    if (!this.league) return;

    this.error = null;
    this.api.getPlayers(this.league, this.pos, this.min90s).subscribe({
      next: (r) => {
        this.players = r.players;

        this.playerA = this.players[0]?.Player ?? '';
        this.playerB = this.players[1]?.Player ?? this.playerA;

        if (this.playerA && this.playerB) {
          this.runCompare();
        }
      },
      error: () => {
        this.error = 'Failed to load players. Is the backend running on :8000?';
      }
    });
  }

  runCompare(): void {
    if (!this.league || !this.playerA || !this.playerB) return;

    this.loading = true;
    this.error = null;

    this.api.compare(this.league, this.playerA, this.playerB, this.pos, this.min90s).subscribe({
      next: (res) => {
        this.loading = false;

        if (res.error) {
          this.error = res.error;
          this.compareResult = null;
          return;
        }

        this.compareResult = res;
        this.computeMaxHeat();
      },
      error: () => {
        this.loading = false;
        this.error = 'Request failed. Is the backend running on :8000?';
      }
    });
  }

  onFiltersChanged(): void {
    // called by (change) handlers in template
    this.loadPlayers();
  }

  private computeMaxHeat(): void {
    if (!this.compareResult) {
      this.maxHeat = 1;
      return;
    }

    const a = this.compareResult.playerA.heatmap.matrix.flat();
    const b = this.compareResult.playerB.heatmap.matrix.flat();

    const m = Math.max(...a, ...b, 1e-6);
    this.maxHeat = m;
  }

  heatStyle(v: number, accent: 'blue' | 'red'): any {
    const raw = v || 0;
    const norm = Math.max(0, Math.min(1, raw / (this.maxHeat || 1)));
    const alpha = 0.15 + norm * 0.75;

    const rgb = accent === 'blue' ? '59,130,246' : '239,68,68';
    return {
      background: `rgba(${rgb}, ${alpha})`,
      border: `1px solid rgba(255,255,255,0.08)`,
    };
  }
}