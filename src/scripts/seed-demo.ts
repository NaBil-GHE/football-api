import 'dotenv/config';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { LeagueModel } from '../modules/leagues/league.model';
import { SeasonModel } from '../modules/leagues/season.model';
import { MatchEventModel } from '../modules/match-events/match-event.model';
import { MatchModel, type MatchStatus } from '../modules/matches/match.model';
import { TeamModel } from '../modules/teams/team.model';

interface SeedTeam {
  name: string;
  shortName: string;
  country: string;
  founded: number;
  stadium: string;
  description: string;
}

const TEAMS: SeedTeam[] = [
  // Spain
  {
    name: 'Real Madrid',
    shortName: 'RMA',
    country: 'Spain',
    founded: 1902,
    stadium: 'Santiago Bernabeu',
    description: 'Spanish football club based in Madrid.',
  },
  {
    name: 'FC Barcelona',
    shortName: 'FCB',
    country: 'Spain',
    founded: 1899,
    stadium: 'Spotify Camp Nou',
    description: 'Catalan football club based in Barcelona.',
  },
  {
    name: 'Atletico Madrid',
    shortName: 'ATM',
    country: 'Spain',
    founded: 1903,
    stadium: 'Civitas Metropolitano',
    description: 'Spanish football club based in Madrid.',
  },
  {
    name: 'Sevilla FC',
    shortName: 'SEV',
    country: 'Spain',
    founded: 1890,
    stadium: 'Ramon Sanchez Pizjuan',
    description: 'Andalusian football club based in Seville.',
  },
  // England
  {
    name: 'Arsenal',
    shortName: 'ARS',
    country: 'England',
    founded: 1886,
    stadium: 'Emirates Stadium',
    description: 'English football club based in North London.',
  },
  {
    name: 'Manchester City',
    shortName: 'MCI',
    country: 'England',
    founded: 1880,
    stadium: 'Etihad Stadium',
    description: 'English football club based in Manchester.',
  },
  {
    name: 'Liverpool',
    shortName: 'LIV',
    country: 'England',
    founded: 1892,
    stadium: 'Anfield',
    description: 'English football club based in Liverpool.',
  },
  {
    name: 'Chelsea',
    shortName: 'CHE',
    country: 'England',
    founded: 1905,
    stadium: 'Stamford Bridge',
    description: 'English football club based in West London.',
  },
  // Morocco
  {
    name: 'Wydad AC',
    shortName: 'WAC',
    country: 'Morocco',
    founded: 1937,
    stadium: 'Stade Mohammed V',
    description: 'Moroccan football club based in Casablanca.',
  },
  {
    name: 'Raja CA',
    shortName: 'RCA',
    country: 'Morocco',
    founded: 1949,
    stadium: 'Stade Mohammed V',
    description: 'Moroccan football club based in Casablanca.',
  },
  {
    name: 'AS FAR',
    shortName: 'FAR',
    country: 'Morocco',
    founded: 1958,
    stadium: 'Prince Moulay Abdellah Stadium',
    description: 'Moroccan football club based in Rabat.',
  },
  {
    name: 'RS Berkane',
    shortName: 'RSB',
    country: 'Morocco',
    founded: 1938,
    stadium: 'Stade Municipal de Berkane',
    description: 'Moroccan football club based in Berkane.',
  },
];

const LEAGUES = [
  { name: 'La Liga', country: 'Spain', type: 'league' as const },
  { name: 'Premier League', country: 'England', type: 'league' as const },
  { name: 'Botola Pro', country: 'Morocco', type: 'league' as const },
];

async function seedDemoData(): Promise<void> {
  await connectDatabase();

  try {
    // 1) Upsert Teams
    const teamMap = new Map<string, string>();
    for (const item of TEAMS) {
      let team = await TeamModel.findOne({
        name: item.name,
        country: item.country,
      }).collation({ locale: 'en', strength: 2 });

      if (!team) {
        team = await TeamModel.create(item);
      }
      teamMap.set(item.shortName, team._id.toString());
    }

    // 2) Upsert Leagues & 2025/2026 Current Seasons
    const leagueMap = new Map<string, { leagueId: string; seasonId: string }>();
    for (const item of LEAGUES) {
      let league = await LeagueModel.findOne({
        name: item.name,
        country: item.country,
      }).collation({ locale: 'en', strength: 2 });

      if (!league) {
        league = await LeagueModel.create(item);
      }

      let season = await SeasonModel.findOne({
        league: league._id,
        name: '2025/2026',
      }).collation({ locale: 'en', strength: 2 });

      if (!season) {
        await SeasonModel.updateMany(
          { league: league._id, current: true },
          { $set: { current: false } },
        );
        season = await SeasonModel.create({
          league: league._id,
          name: '2025/2026',
          startDate: new Date('2025-08-15T00:00:00.000Z'),
          endDate: new Date('2026-05-30T23:59:59.000Z'),
          current: true,
        });
      }

      leagueMap.set(item.name, {
        leagueId: league._id.toString(),
        seasonId: season._id.toString(),
      });
    }

    const now = Date.now();
    const hour = 3600_000;
    const day = 24 * hour;

    interface SeedEvent {
      teamCode: string;
      type:
        | 'goal'
        | 'own_goal'
        | 'penalty'
        | 'yellow_card'
        | 'red_card'
        | 'substitution'
        | 'injury'
        | 'var'
        | 'other';
      minute: number;
      addedTime?: number;
      player?: string;
      playerIn?: string;
      playerOut?: string;
      description?: string;
    }

    interface SeedMatch {
      leagueName: string;
      home: string;
      away: string;
      kickoff: Date;
      venue: string;
      round: string;
      status: MatchStatus;
      homeScore: number;
      awayScore: number;
      minute: number;
      events: SeedEvent[];
    }

    const matchesToSeed: SeedMatch[] = [
      // La Liga
      {
        leagueName: 'La Liga',
        home: 'RMA',
        away: 'FCB',
        kickoff: new Date(now - 5 * day),
        venue: 'Santiago Bernabeu',
        round: 'Matchday 1',
        status: 'finished',
        homeScore: 2,
        awayScore: 1,
        minute: 90,
        events: [
          { teamCode: 'RMA', type: 'goal', minute: 19, player: 'Vinicius Jr', description: 'Cut inside from the left wing' },
          { teamCode: 'FCB', type: 'goal', minute: 41, player: 'Lamine Yamal', description: 'Curled effort into the far corner' },
          { teamCode: 'FCB', type: 'yellow_card', minute: 58, player: 'Gavi' },
          { teamCode: 'RMA', type: 'goal', minute: 84, player: 'Jude Bellingham', description: 'Late header from close range' },
        ],
      },
      {
        leagueName: 'La Liga',
        home: 'ATM',
        away: 'SEV',
        kickoff: new Date(now - 4 * day),
        venue: 'Civitas Metropolitano',
        round: 'Matchday 1',
        status: 'finished',
        homeScore: 1,
        awayScore: 1,
        minute: 90,
        events: [
          { teamCode: 'ATM', type: 'goal', minute: 32, player: 'Antoine Griezmann' },
          { teamCode: 'SEV', type: 'goal', minute: 76, player: 'Youssef En-Nesyri' },
        ],
      },
      {
        leagueName: 'La Liga',
        home: 'FCB',
        away: 'SEV',
        kickoff: new Date(now - 2 * day),
        venue: 'Spotify Camp Nou',
        round: 'Matchday 2',
        status: 'finished',
        homeScore: 3,
        awayScore: 0,
        minute: 90,
        events: [
          { teamCode: 'FCB', type: 'goal', minute: 14, player: 'Robert Lewandowski' },
          { teamCode: 'FCB', type: 'penalty', minute: 51, player: 'Robert Lewandowski' },
          { teamCode: 'FCB', type: 'goal', minute: 80, player: 'Pedri' },
        ],
      },
      {
        leagueName: 'La Liga',
        home: 'RMA',
        away: 'ATM',
        kickoff: new Date(now - hour),
        venue: 'Santiago Bernabeu',
        round: 'Matchday 2',
        status: 'live',
        homeScore: 2,
        awayScore: 1,
        minute: 67,
        events: [
          { teamCode: 'RMA', type: 'goal', minute: 12, player: 'Kylian Mbappe' },
          { teamCode: 'ATM', type: 'penalty', minute: 38, player: 'Julian Alvarez' },
          { teamCode: 'RMA', type: 'yellow_card', minute: 45, addedTime: 2, player: 'Federico Valverde' },
          { teamCode: 'RMA', type: 'goal', minute: 61, player: 'Vinicius Jr' },
          { teamCode: 'RMA', type: 'substitution', minute: 65, playerIn: 'Luka Modric', playerOut: 'Eduardo Camavinga' },
        ],
      },
      {
        leagueName: 'La Liga',
        home: 'SEV',
        away: 'RMA',
        kickoff: new Date(now + 2 * day),
        venue: 'Ramon Sanchez Pizjuan',
        round: 'Matchday 3',
        status: 'scheduled',
        homeScore: 0,
        awayScore: 0,
        minute: 0,
        events: [],
      },

      // Premier League
      {
        leagueName: 'Premier League',
        home: 'ARS',
        away: 'CHE',
        kickoff: new Date(now - 4 * day),
        venue: 'Emirates Stadium',
        round: 'Matchday 1',
        status: 'finished',
        homeScore: 2,
        awayScore: 0,
        minute: 90,
        events: [
          { teamCode: 'ARS', type: 'goal', minute: 27, player: 'Bukayo Saka' },
          { teamCode: 'ARS', type: 'goal', minute: 71, player: 'Martin Odegaard' },
        ],
      },
      {
        leagueName: 'Premier League',
        home: 'MCI',
        away: 'LIV',
        kickoff: new Date(now - 3 * day),
        venue: 'Etihad Stadium',
        round: 'Matchday 1',
        status: 'finished',
        homeScore: 2,
        awayScore: 2,
        minute: 90,
        events: [
          { teamCode: 'MCI', type: 'goal', minute: 18, player: 'Erling Haaland' },
          { teamCode: 'LIV', type: 'goal', minute: 34, player: 'Mohamed Salah' },
          { teamCode: 'MCI', type: 'goal', minute: 62, player: 'Phil Foden' },
          { teamCode: 'LIV', type: 'goal', minute: 88, player: 'Luis Diaz' },
        ],
      },
      {
        leagueName: 'Premier League',
        home: 'LIV',
        away: 'ARS',
        kickoff: new Date(now - 50 * 60_000),
        venue: 'Anfield',
        round: 'Matchday 2',
        status: 'halftime',
        homeScore: 1,
        awayScore: 0,
        minute: 45,
        events: [
          { teamCode: 'LIV', type: 'goal', minute: 29, player: 'Mohamed Salah' },
          { teamCode: 'ARS', type: 'yellow_card', minute: 43, player: 'Declan Rice' },
        ],
      },
      {
        leagueName: 'Premier League',
        home: 'CHE',
        away: 'MCI',
        kickoff: new Date(now + 3 * day),
        venue: 'Stamford Bridge',
        round: 'Matchday 2',
        status: 'scheduled',
        homeScore: 0,
        awayScore: 0,
        minute: 0,
        events: [],
      },

      // Botola Pro
      {
        leagueName: 'Botola Pro',
        home: 'WAC',
        away: 'RCA',
        kickoff: new Date(now - 3 * day),
        venue: 'Stade Mohammed V',
        round: 'Matchday 1',
        status: 'finished',
        homeScore: 2,
        awayScore: 1,
        minute: 90,
        events: [
          { teamCode: 'WAC', type: 'goal', minute: 23, player: 'Ayoub El Amloud' },
          { teamCode: 'RCA', type: 'penalty', minute: 54, player: 'Yousri Bouzok' },
          { teamCode: 'WAC', type: 'goal', minute: 86, player: 'Saifeddine Bouhra' },
        ],
      },
      {
        leagueName: 'Botola Pro',
        home: 'FAR',
        away: 'RSB',
        kickoff: new Date(now - 2 * day),
        venue: 'Prince Moulay Abdellah Stadium',
        round: 'Matchday 1',
        status: 'finished',
        homeScore: 1,
        awayScore: 0,
        minute: 90,
        events: [
          { teamCode: 'FAR', type: 'goal', minute: 64, player: 'Mohamed Hrimat' },
        ],
      },
      {
        leagueName: 'Botola Pro',
        home: 'RCA',
        away: 'FAR',
        kickoff: new Date(now + day),
        venue: 'Stade Mohammed V',
        round: 'Matchday 2',
        status: 'scheduled',
        homeScore: 0,
        awayScore: 0,
        minute: 0,
        events: [],
      },
    ];

    let createdMatches = 0;
    let createdEvents = 0;

    for (const item of matchesToSeed) {
      const leagueInfo = leagueMap.get(item.leagueName);
      const homeTeamId = teamMap.get(item.home);
      const awayTeamId = teamMap.get(item.away);
      if (!leagueInfo || !homeTeamId || !awayTeamId) continue;

      const existing = await MatchModel.findOne({
        league: leagueInfo.leagueId,
        season: leagueInfo.seasonId,
        homeTeam: homeTeamId,
        awayTeam: awayTeamId,
        round: item.round,
      });

      if (existing) continue;

      const match = await MatchModel.create({
        league: leagueInfo.leagueId,
        season: leagueInfo.seasonId,
        homeTeam: homeTeamId,
        awayTeam: awayTeamId,
        kickoff: item.kickoff,
        venue: item.venue,
        round: item.round,
        status: item.status,
        homeScore: item.homeScore,
        awayScore: item.awayScore,
        minute: item.minute,
      });
      createdMatches += 1;

      for (const ev of item.events) {
        const evTeamId = teamMap.get(ev.teamCode);
        if (!evTeamId) continue;
        await MatchEventModel.create({
          match: match._id,
          team: evTeamId,
          type: ev.type,
          minute: ev.minute,
          addedTime: ev.addedTime ?? 0,
          player: ev.player,
          playerIn: ev.playerIn,
          playerOut: ev.playerOut,
          description: ev.description,
        });
        createdEvents += 1;
      }
    }

    const [teamsCount, leaguesCount, seasonsCount, matchesCount, eventsCount] =
      await Promise.all([
        TeamModel.countDocuments(),
        LeagueModel.countDocuments(),
        SeasonModel.countDocuments(),
        MatchModel.countDocuments(),
        MatchEventModel.countDocuments(),
      ]);

    console.log(
      `[Seed Demo] Done! Created ${createdMatches} matches & ${createdEvents} events.`,
    );
    console.log(
      `[Seed Demo] Totals -> Teams: ${teamsCount}, Leagues: ${leaguesCount}, Seasons: ${seasonsCount}, Matches: ${matchesCount}, Events: ${eventsCount}`,
    );
  } finally {
    await disconnectDatabase();
  }
}

void seedDemoData().catch((error: unknown) => {
  console.error('[Seed Demo] Failed:', error);
  process.exit(1);
});
