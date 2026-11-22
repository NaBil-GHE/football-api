import { LeagueModel } from '../leagues/league.model';
import { MatchModel } from '../matches/match.model';
import { MATCH_POPULATE } from '../matches/match.service';
import { TeamModel } from '../teams/team.model';

export async function getDashboardLiveMatches(limit = 10) {
  return await MatchModel.find({ status: { $in: ['live', 'halftime'] } })
    .populate(MATCH_POPULATE)
    .sort({ kickoff: 1 })
    .limit(limit)
    .lean()
    .exec();
}

export async function getDashboardUpcomingMatches(limit = 10) {
  return await MatchModel.find({
    status: 'scheduled',
    kickoff: { $gte: new Date() },
  })
    .populate(MATCH_POPULATE)
    .sort({ kickoff: 1 })
    .limit(limit)
    .lean()
    .exec();
}

export async function getDashboardRecentResults(limit = 10) {
  return await MatchModel.find({ status: 'finished' })
    .populate(MATCH_POPULATE)
    .sort({ kickoff: -1 })
    .limit(limit)
    .lean()
    .exec();
}

export async function getDashboardOverview() {
  const now = new Date();

  const [
    teamsCount,
    leaguesCount,
    matchesCount,
    liveMatchesCount,
    upcomingMatchesCount,
    finishedMatchesCount,
    liveMatches,
    upcomingMatches,
    recentResults,
  ] = await Promise.all([
    TeamModel.countDocuments(),
    LeagueModel.countDocuments(),
    MatchModel.countDocuments(),
    MatchModel.countDocuments({ status: { $in: ['live', 'halftime'] } }),
    MatchModel.countDocuments({ status: 'scheduled', kickoff: { $gte: now } }),
    MatchModel.countDocuments({ status: 'finished' }),
    getDashboardLiveMatches(5),
    getDashboardUpcomingMatches(5),
    getDashboardRecentResults(5),
  ]);

  return {
    counts: {
      teams: teamsCount,
      leagues: leaguesCount,
      matches: matchesCount,
      liveMatches: liveMatchesCount,
      upcomingMatches: upcomingMatchesCount,
      finishedMatches: finishedMatchesCount,
    },
    liveMatches,
    upcomingMatches,
    recentResults,
  };
}
