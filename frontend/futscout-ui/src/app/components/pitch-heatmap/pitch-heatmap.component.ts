import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-pitch-heatmap',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pitch-heatmap.component.html',
  styleUrl: './pitch-heatmap.component.scss',
})
export class PitchHeatmapComponent {
  /**
   * Expected: [def, mid, att] values in range 0..1
   */
  @Input() thirds: number[] = [0, 0, 0];

  /**
   * 'blue' | 'red'
   */
  @Input() accent: 'blue' | 'red' = 'blue';

  private clamp01(v: number): number {
    return Math.max(0, Math.min(1, v || 0));
  }

  private rgb(): string {
    return this.accent === 'blue'
      ? '59,130,246'
      : '239,68,68';
  }

  zoneStyle(v: number): any {
    const n = this.clamp01(v);
    const rgb = this.rgb();

    // Blob grows & brightens with value
    const width = 40 + n * 40;      // 40% → 80%
    const alphaCore = 0.15 + n * 0.55;
    const alphaFade = 0.04 + n * 0.16;
    const blur = 12 + n * 18;

    return {
      width: `${width}%`,
      background: `radial-gradient(ellipse at center,
        rgba(${rgb}, ${alphaCore}) 0%,
        rgba(${rgb}, ${alphaFade}) 55%,
        rgba(${rgb}, 0) 75%
      )`,
      filter: `blur(${blur}px)`,
      boxShadow: `0 0 ${22 + n * 36}px rgba(${rgb}, ${0.12 + n * 0.25})`,
    };
  }

  pct(v: number): string {
    return `${Math.round(this.clamp01(v) * 100)}%`;
  }
}