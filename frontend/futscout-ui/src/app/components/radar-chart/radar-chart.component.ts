import { Component, ElementRef, Input, OnChanges, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  Chart,
  RadarController,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
} from 'chart.js';

Chart.register(
  RadarController,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

@Component({
  selector: 'app-radar-chart',
  standalone: true,
  imports: [CommonModule],
  template: `<canvas #canvas></canvas>`,
  styles: [`
    :host { display: block; }
    canvas { width: 100% !important; height: 320px !important; }
  `]
})
export class RadarChartComponent implements OnChanges {
  @Input() labels: string[] = [];
  @Input() aName = 'Player A';
  @Input() bName = 'Player B';
  @Input() aData: number[] = []; // percentiles 0..100
  @Input() bData: number[] = [];

  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  private chart: Chart | null = null;

  ngOnChanges(): void {
    this.render();
  }

  private render(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;

    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }

    // Guard: labels/data lengths
    const n = this.labels.length;
    if (!n) return;

    const a = (this.aData ?? []).slice(0, n);
    const b = (this.bData ?? []).slice(0, n);

    this.chart = new Chart(canvas, {
      type: 'radar',
      data: {
        labels: this.labels,
        datasets: [
          {
            label: this.aName,
            data: a,
            borderColor: 'rgba(59,130,246,1)',     // blue
            backgroundColor: 'rgba(59,130,246,0.18)',
            pointBackgroundColor: 'rgba(59,130,246,1)',
            borderWidth: 2
          },
          {
            label: this.bName,
            data: b,
            borderColor: 'rgba(239,68,68,1)',      // red
            backgroundColor: 'rgba(239,68,68,0.14)',
            pointBackgroundColor: 'rgba(239,68,68,1)',
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#e5e7eb' } },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${ctx.raw} percentile`
            }
          }
        },
        scales: {
          r: {
            min: 0,
            max: 100,
            ticks: {
              stepSize: 20,
              color: '#9ca3af',
              backdropColor: 'transparent'
            },
            grid: { color: 'rgba(255,255,255,0.10)' },
            angleLines: { color: 'rgba(255,255,255,0.10)' },
            pointLabels: { color: '#cbd5e1', font: { size: 12 } }
          }
        }
      }
    });
  }
}