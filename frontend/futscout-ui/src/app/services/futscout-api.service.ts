import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface LeagueResponse { leagues: string[]; }
export interface PositionResponse { positions: string[]; }

export interface PlayerListItem {
  Player: string;
  Squad: string;
  Pos: string;
  Age: number | null;
  Min: number | null;
  '90s': number | null;
}

export interface PlayersResponse { players: PlayerListItem[]; }

export interface CompareResponse {
  error?: string;
  league: string;
  filters: { pos: string; min90s: number };
  playerA: {
    name: string; squad: string; pos: string;
    age: number | null; minutes: number | null; nineties: number | null;
    radar: { labels: string[]; percentiles: number[]; values: number[]; overall: number };
    heatmap: { matrix: number[][]; xLabels: string[]; yLabels: string[] };
  };
  playerB: {
    name: string; squad: string; pos: string;
    age: number | null; minutes: number | null; nineties: number | null;
    radar: { labels: string[]; percentiles: number[]; values: number[]; overall: number };
    heatmap: { matrix: number[][]; xLabels: string[]; yLabels: string[] };
  };
}

@Injectable({ providedIn: 'root' })
export class FutscoutApiService {
  private baseUrl = 'http://127.0.0.1:8000';

  constructor(private http: HttpClient) {}

  getLeagues(): Observable<LeagueResponse> {
    return this.http.get<LeagueResponse>(`${this.baseUrl}/meta/leagues`);
  }

  getPositions(): Observable<PositionResponse> {
    return this.http.get<PositionResponse>(`${this.baseUrl}/meta/positions`);
  }

  getPlayers(league: string, pos: string, min90s: number): Observable<PlayersResponse> {
    let params = new HttpParams()
      .set('league', league)
      .set('pos', pos)
      .set('min90s', min90s);
    return this.http.get<PlayersResponse>(`${this.baseUrl}/players`, { params });
  }

  compare(league: string, playerA: string, playerB: string, pos: string, min90s: number): Observable<CompareResponse> {
    let params = new HttpParams()
      .set('league', league)
      .set('player_a', playerA)
      .set('player_b', playerB)
      .set('pos', pos)
      .set('min90s', min90s);
    return this.http.get<CompareResponse>(`${this.baseUrl}/compare`, { params });
  }
}