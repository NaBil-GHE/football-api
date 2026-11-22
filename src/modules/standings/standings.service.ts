import { AppError } from '../../utils/app-error';
import { assertValidObjectId } from '../../utils/validation';
import { LeagueModel } from '../leagues/league.model';
import { SeasonModel, type SeasonDocument } from '../leagues/season.model';
import { MatchModel } from '../matches/match.model';
import type { TeamDocument } from '../teams/team.model';

export interface StandingRow {
  position: number;
  team: {
    _id: string;
    name: string;
    shortName: string;
    logo?: string | undefined;
  };
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface LeagueStandingsResult {
  league: {
    _id: string;
    name: string;
    country: string;
    type: string;
  };
  season: {
    _id: string;
    name: string;
    startDate: Date;
    endDate: Date;
    current: boolean;
  } | null;
  standings: StandingRow[];
}

interface PopulatedTeamRef {
  _id: { toString(): string };
  name: string;
  shortName: string;
  logo?: string | undefined;
}

export async function getLeagueStandings(
  leagueId: string,
  seasonId?: string,
): Promise<LeagueStandingsResult> {
  assertValidObjectId(leagueId, 'league id');

  const league = await LeagueModel.findById(leagueId).lean();
  if (!league) {
    throw new AppError('League not found', 404, 'LEAGUE_NOT_FOUND');
  }

  let season: SeasonDocument | null = null;

  if (seasonId) {
    assertValidObjectId(seasonId, 'season id');
    season = await SeasonModel.findOne({ _id: seasonId, league: league._id });
    if (!season) {
      throw new AppError(
        'Season not found for this league',
        404,
        'SEASON_NOT_FOUND',
      );
    }
  } else {
    season =
      (await SeasonModel.findOne({ league: league._id, current: true })) ??
      (await SeasonModel.findOne({ league: league._id }).sort({ startDate: -1 }));
  }

  if (!season) {
    return {
      league: {
        _id: league._id.toString(),
        name: league.name,
        country: league.country,
        type: league.type,
      },
      season: null,
      standings: [],
    };
  }

  const finishedMatches = await MatchModel.find({
    league: league._id,
    season: season._id,
    status: 'finished',
  })
    .populate<{ homeTeam: TeamDocument; awayTeam: TeamDocument }>([
      { path: 'homeTeam', select: 'name shortName logo' },
      { path: 'awayTeam', select: 'name shortName logo' },
    ])
    .lean()
    .exec();

  const table = new Map<string, Omit<StandingRow, 'position'>>();

  const ensureTeamRow = (team: PopulatedTeamRef) => {
    const id = team._id.toString();
    let row = table.get(id);
    if (!row) {
      row = {
        team: {
          _id: id,
          name: team.name,
          shortName: team.shortName,
          ...(team.logo ? { logo: team.logo } : {}),
        },
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
      };
      table.set(id, row);
    }
    return row;
  };

  for (const match of finishedMatches) {
    if (!match.homeTeam || !match.awayTeam) {
      continue;
    }

    const homeRow = ensureTeamRow(match.homeTeam);
    const awayRow = ensureTeamRow(match.awayTeam);

    homeRow.played += 1;
    awayRow.played += 1;

    homeRow.goalsFor += match.homeScore;
    homeRow.goalsAgainst += match.awayScore;
    awayRow.goalsFor += match.awayScore;
    awayRow.goalsAgainst += match.homeScore;

    if (match.homeScore > match.awayScore) {
      homeRow.won += 1;
      homeRow.points += 3;
      awayRow.lost += 1;
    } else if (match.homeScore < match.awayScore) {
      awayRow.won += 1;
      awayRow.points += 3;
      homeRow.lost += 1;
    } else {
      homeRow.drawn += 1;
      awayRow.drawn += 1;
      homeRow.points += 1;
      awayRow.points += 1;
    }

    homeRow.goalDifference = homeRow.goalsFor - homeRow.goalsAgainst;
    awayRow.goalDifference = awayRow.goalsFor - awayRow.goalsAgainst;
  }

  const sorted = Array.from(table.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) {
      return b.goalDifference - a.goalDifference;
    }
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.team.name.localeCompare(b.team.name);
  });

  const standings: StandingRow[] = sorted.map((row, index) => ({
    position: index + 1,
    ...row,
  }));

  return {
    league: {
      _id: league._id.toString(),
      name: league.name,
      country: league.country,
      type: league.type,
    },
    season: {
      _id: season._id.toString(),
      name: season.name,
      startDate: season.startDate,
      endDate: season.endDate,
      current: season.current,
    },
    standings,
  };
}
